import { Op } from "sequelize";

import Ticket from "../../models/Ticket";
import Flow from "../../models/Flow";
import FlowBinding from "../../models/FlowBinding";
import FlowExecution from "../../models/FlowExecution";
import FlowExecutionEvent from "../../models/FlowExecutionEvent";
import FlowVersion from "../../models/FlowVersion";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import buildBackendBaseUrl from "../../helpers/buildBackendBaseUrl";

import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import { compileGraph, CompiledFlow, findNextByHandle } from "./FlowCompiler";

interface RuntimeContext {
  companyId: number;
  ticket: Ticket;
  inputText: string;
}

const normalizeInput = (value: string): string => {
  return String(value || "").trim().toLowerCase();
};

const buildFlowMediaUrl = (rawMediaPath: string): string => {
  const mediaPath = String(rawMediaPath || "").trim();
  if (!mediaPath) return "";

  if (/^https?:\/\//i.test(mediaPath)) {
    return mediaPath;
  }

  const cleanedPath = mediaPath.replace(/^\/+/, "").replace(/^public\//, "");
  const backendBase = buildBackendBaseUrl();

  return backendBase
    ? `${backendBase}/public/${cleanedPath}`
    : `/public/${cleanedPath}`;
};

const stringifyMenuOption = (option: any): string => {
  const id = String(option?.id || "").trim();
  const label = String(option?.label || option?.id || "").trim();
  if (!id && !label) return "";
  if (!id) return label;
  if (!label) return id;
  return `${id} - ${label}`;
};

const buildMenuMessage = (prompt: string, options: any[]): string => {
  const normalizedOptions = (Array.isArray(options) ? options : [])
    .map((option) => ({
      id: String(option?.id || "").trim(),
      label: String(option?.label || option?.id || "").trim(),
      keywords: Array.isArray(option?.keywords) ? option.keywords : []
    }))
    .filter((option) => option.id);

  if (!normalizedOptions.length) {
    return prompt;
  }

  const optionsText = normalizedOptions
    .map((option) => stringifyMenuOption(option))
    .filter(Boolean)
    .join("\n");

  return `${prompt}\n\n${optionsText}`;
};

const ensureContext = (execution: FlowExecution): any => {
  if (!execution.contextJson || typeof execution.contextJson !== "object") {
    execution.contextJson = {};
  }

  if (!execution.contextJson.menuAttempts || typeof execution.contextJson.menuAttempts !== "object") {
    execution.contextJson.menuAttempts = {};
  }

  return execution.contextJson;
};

const appendExecutionEvent = async (
  execution: FlowExecution,
  actionType: string,
  nodeKey?: string,
  payload?: any
): Promise<void> => {
  await FlowExecutionEvent.create({
    executionId: execution.id,
    companyId: execution.companyId,
    nodeKey: nodeKey || null,
    actionType,
    payloadJson: payload || null
  });
};

const getCompiledFlow = (flowVersion: FlowVersion): CompiledFlow | null => {
  const compiled = flowVersion.compiledJson;

  if (compiled && typeof compiled === "object" && compiled.nodes && compiled.edgesBySource) {
    return compiled as CompiledFlow;
  }

  const graph = flowVersion.graphJson || {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];

  if (!nodes.length) {
    return null;
  }

  return compileGraph(nodes, edges);
};

const evaluateCondition = (conditionConfig: any, context: RuntimeContext): boolean => {
  const rules = Array.isArray(conditionConfig?.rules) ? conditionConfig.rules : [];
  if (!rules.length) {
    return false;
  }

  const op = String(conditionConfig?.operator || "all");

  const compare = (field: string, operator: string, value: any): boolean => {
    let current: any = null;

    if (field === "ticket.queueId") {
      current = context.ticket.queueId;
    } else if (field === "ticket.whatsappId") {
      current = context.ticket.whatsappId;
    } else if (field === "ticket.status") {
      current = context.ticket.status;
    } else if (field === "contact.number") {
      current = context.ticket.contact?.number;
    } else if (field === "contact.name") {
      current = context.ticket.contact?.name;
    } else if (field === "company.id") {
      current = context.companyId;
    } else if (field === "input.text") {
      current = context.inputText;
    }

    if (operator === "eq") {
      return String(current) === String(value);
    }
    if (operator === "neq") {
      return String(current) !== String(value);
    }
    if (operator === "contains") {
      return String(current || "").toLowerCase().includes(String(value || "").toLowerCase());
    }
    if (operator === "in" && Array.isArray(value)) {
      return value.map(String).includes(String(current));
    }

    return false;
  };

  const outcomes = rules.map((rule) => compare(String(rule.field || ""), String(rule.op || "eq"), rule.value));

  if (op === "any") {
    return outcomes.some(Boolean);
  }

  return outcomes.every(Boolean);
};

const executeQueueTransfer = async (
  execution: FlowExecution,
  context: RuntimeContext,
  nodeConfig: any
): Promise<void> => {
  const queueId = Number(nodeConfig?.queueId || 0);
  if (!queueId) {
    await appendExecutionEvent(execution, "queue_transfer_invalid", execution.currentNodeKey, { queueId });
    return;
  }

  const queue = await Queue.findOne({ where: { id: queueId, companyId: context.companyId } });
  if (!queue) {
    await appendExecutionEvent(execution, "queue_transfer_queue_not_found", execution.currentNodeKey, { queueId });
    return;
  }

  if (nodeConfig?.message) {
    await SendWhatsAppMessage({ body: String(nodeConfig.message), ticket: context.ticket });
  }

  const { default: UpdateTicketService } = await import("../TicketServices/UpdateTicketService");
  await UpdateTicketService({
    ticketData: {
      queueId,
      userId: null,
      status: nodeConfig?.setPending === false ? context.ticket.status : "pending",
      chatbot: false,
      queueOptionId: null,
      useIntegration: false,
      integrationId: null,
      promptId: null
    },
    ticketId: context.ticket.id,
    companyId: context.companyId
  });

  await appendExecutionEvent(execution, "queue_transfer_success", execution.currentNodeKey, { queueId });
};

const executeAgentAssign = async (
  execution: FlowExecution,
  context: RuntimeContext,
  nodeConfig: any
): Promise<void> => {
  const userId = Number(nodeConfig?.userId || 0);
  if (!userId) {
    await appendExecutionEvent(execution, "agent_assign_invalid", execution.currentNodeKey, { userId });
    return;
  }

  const user = await User.findOne({ where: { id: userId, companyId: context.companyId } });
  if (!user) {
    await appendExecutionEvent(execution, "agent_assign_user_not_found", execution.currentNodeKey, { userId });
    return;
  }

  const { default: UpdateTicketService } = await import("../TicketServices/UpdateTicketService");
  await UpdateTicketService({
    ticketData: {
      userId,
      status: "open",
      chatbot: false,
      queueOptionId: null,
      useIntegration: false,
      integrationId: null,
      promptId: null
    },
    ticketId: context.ticket.id,
    companyId: context.companyId
  });

  await appendExecutionEvent(execution, "agent_assign_success", execution.currentNodeKey, { userId });
};

const applyNode = async (
  compiled: CompiledFlow,
  execution: FlowExecution,
  context: RuntimeContext
): Promise<{ done: boolean; wait: boolean }> => {
  const node = compiled.nodes[execution.currentNodeKey];

  if (!node) {
    await appendExecutionEvent(execution, "node_not_found", execution.currentNodeKey);
    execution.status = "failed";
    execution.finishedAt = new Date();
    await execution.save();
    return { done: true, wait: false };
  }

  if (node.nodeType === "start") {
    const next = findNextByHandle(compiled, node.nodeKey, "default");
    if (!next) {
      execution.status = "failed";
      execution.finishedAt = new Date();
      await appendExecutionEvent(execution, "start_without_transition", node.nodeKey);
      await execution.save();
      return { done: true, wait: false };
    }

    execution.currentNodeKey = next;
    await appendExecutionEvent(execution, "transition", node.nodeKey, { nextNodeKey: next });
    return { done: false, wait: false };
  }

  if (node.nodeType === "message") {
    const messageType = String(node.config?.messageType || "text").trim().toLowerCase();
    const text = String(node.config?.text || "").trim();
    const mediaPathUrl = buildFlowMediaUrl(String(node.config?.mediaPath || "").trim());
    const mediaUrl = mediaPathUrl || String(node.config?.mediaUrl || "").trim();
    const isMediaMessage = messageType === "image" || messageType === "video";

    if (isMediaMessage && mediaUrl) {
      await SendWhatsAppMessage({
        body: text,
        ticket: context.ticket,
        mediaType: messageType as "image" | "video",
        mediaUrl
      });
      await appendExecutionEvent(execution, "message_sent", node.nodeKey, {
        text,
        messageType,
        mediaUrl
      });
    } else if (text) {
      await SendWhatsAppMessage({ body: text, ticket: context.ticket });
      await appendExecutionEvent(execution, "message_sent", node.nodeKey, {
        text,
        messageType: "text"
      });
    } else if (isMediaMessage && !mediaUrl) {
      await appendExecutionEvent(execution, "message_media_missing_url", node.nodeKey, {
        messageType
      });
    }

    const next = findNextByHandle(compiled, node.nodeKey, "default");
    if (!next) {
      execution.status = "completed";
      execution.finishedAt = new Date();
      await appendExecutionEvent(execution, "message_end", node.nodeKey);
      await execution.save();
      return { done: true, wait: false };
    }

    execution.currentNodeKey = next;
    return { done: false, wait: false };
  }

  if (node.nodeType === "menu") {
    const menuConfig = node.config || {};
    let options = Array.isArray(menuConfig.options) ? menuConfig.options : [];
    if (!options.length) {
      const outgoing = compiled.edgesBySource[node.nodeKey] || [];
      const handles = Array.from(
        new Set(
          outgoing
            .map((edge) => String(edge?.sourceHandle || edge?.conditionValue || "").trim())
            .filter((handle) => handle && !["default", "fallback", "else", "true", "false"].includes(handle))
        )
      );
      options = handles.map((handle) => ({
        id: handle,
        label: `Opcao ${handle}`,
        keywords: []
      }));
    }
    const prompt = String(menuConfig.prompt || "Digite uma opção:").trim();
    const menuMessage = buildMenuMessage(prompt, options);

    if (execution.status !== "waiting_input") {
      await SendWhatsAppMessage({ body: menuMessage, ticket: context.ticket });
      execution.status = "waiting_input";
      execution.lastInteractionAt = new Date();
      await appendExecutionEvent(execution, "menu_prompt", node.nodeKey, { prompt, options });
      await execution.save();
      return { done: false, wait: true };
    }

    const normalizedInput = normalizeInput(context.inputText);
    let chosenOptionId: string | null = null;

    for (const option of options) {
      const optionId = String(option?.id || "").trim();
      const keywords = (Array.isArray(option?.keywords) ? option.keywords : []).map((keyword: any) => normalizeInput(String(keyword)));

      if (!optionId) {
        continue;
      }

      if (normalizedInput === normalizeInput(optionId) || keywords.includes(normalizedInput)) {
        chosenOptionId = optionId;
        break;
      }
    }

    if (chosenOptionId) {
      const nextNodeKey = findNextByHandle(compiled, node.nodeKey, chosenOptionId);
      if (!nextNodeKey) {
        execution.status = "failed";
        execution.finishedAt = new Date();
        await appendExecutionEvent(execution, "menu_option_without_transition", node.nodeKey, { chosenOptionId });
        await execution.save();
        return { done: true, wait: false };
      }

      const execContext = ensureContext(execution);
      execContext.menuAttempts[node.nodeKey] = 0;

      execution.status = "running";
      execution.currentNodeKey = nextNodeKey;
      execution.contextJson = execContext;
      execution.lastInteractionAt = new Date();

      await appendExecutionEvent(execution, "menu_option_selected", node.nodeKey, { chosenOptionId, nextNodeKey });
      return { done: false, wait: false };
    }

    const fallbackMessage = String(menuConfig?.fallback?.message || "Opção inválida. Tente novamente.").trim();
    const maxAttempts = Number(menuConfig?.fallback?.maxAttempts || 2);

    const execContext = ensureContext(execution);
    const attempts = Number(execContext.menuAttempts[node.nodeKey] || 0) + 1;
    execContext.menuAttempts[node.nodeKey] = attempts;

    if (attempts <= maxAttempts) {
      const retryMessage = `${fallbackMessage}\n\n${menuMessage}`;
      await SendWhatsAppMessage({ body: retryMessage, ticket: context.ticket });
      execution.contextJson = execContext;
      execution.status = "waiting_input";
      execution.lastInteractionAt = new Date();
      await appendExecutionEvent(execution, "menu_invalid_input", node.nodeKey, { attempts, maxAttempts });
      await execution.save();
      return { done: false, wait: true };
    }

    const fallbackHandle = String(menuConfig?.fallback?.nextHandle || "fallback");
    const nextNodeKey = findNextByHandle(compiled, node.nodeKey, fallbackHandle);

    if (!nextNodeKey) {
      execution.status = "failed";
      execution.finishedAt = new Date();
      await appendExecutionEvent(execution, "menu_fallback_missing", node.nodeKey, { fallbackHandle });
      await execution.save();
      return { done: true, wait: false };
    }

    execution.status = "running";
    execution.currentNodeKey = nextNodeKey;
    execution.contextJson = execContext;
    execution.lastInteractionAt = new Date();

    await appendExecutionEvent(execution, "menu_fallback_transition", node.nodeKey, {
      attempts,
      fallbackHandle,
      nextNodeKey
    });

    return { done: false, wait: false };
  }

  if (node.nodeType === "condition") {
    const conditionResult = evaluateCondition(node.config || {}, context);
    const nextNodeKey = findNextByHandle(compiled, node.nodeKey, conditionResult ? "true" : "false");

    if (!nextNodeKey) {
      execution.status = "failed";
      execution.finishedAt = new Date();
      await appendExecutionEvent(execution, "condition_without_transition", node.nodeKey, { conditionResult });
      await execution.save();
      return { done: true, wait: false };
    }

    execution.currentNodeKey = nextNodeKey;
    await appendExecutionEvent(execution, "condition_transition", node.nodeKey, { conditionResult, nextNodeKey });
    return { done: false, wait: false };
  }

  if (node.nodeType === "queue_transfer") {
    await executeQueueTransfer(execution, context, node.config || {});
    execution.status = "completed";
    execution.finishedAt = new Date();
    await execution.save();
    return { done: true, wait: false };
  }

  if (node.nodeType === "agent_assign") {
    await executeAgentAssign(execution, context, node.config || {});
    execution.status = "completed";
    execution.finishedAt = new Date();
    await execution.save();
    return { done: true, wait: false };
  }

  if (node.nodeType === "delay") {
    const delaySeconds = Number(node.config?.seconds || 0);
    execution.status = "waiting_timeout";
    execution.waitUntil = new Date(Date.now() + Math.max(delaySeconds, 1) * 1000);
    await appendExecutionEvent(execution, "delay_waiting", node.nodeKey, { delaySeconds });
    await execution.save();
    return { done: false, wait: true };
  }

  if (node.nodeType === "end") {
    if (node.config?.farewellMessage) {
      await SendWhatsAppMessage({ body: String(node.config.farewellMessage), ticket: context.ticket });
    }

    if (node.config?.closeTicket === true) {
      const { default: UpdateTicketService } = await import("../TicketServices/UpdateTicketService");
      await UpdateTicketService({
        ticketData: {
          status: "closed",
          chatbot: false,
          queueOptionId: null,
          useIntegration: false,
          integrationId: null,
          promptId: null
        },
        ticketId: context.ticket.id,
        companyId: context.companyId
      });
    }

    execution.status = "completed";
    execution.finishedAt = new Date();
    await appendExecutionEvent(execution, "flow_completed", node.nodeKey);
    await execution.save();
    return { done: true, wait: false };
  }

  const nextNodeKey = findNextByHandle(compiled, node.nodeKey, "default");
  if (!nextNodeKey) {
    execution.status = "completed";
    execution.finishedAt = new Date();
    await appendExecutionEvent(execution, "node_without_next_transition", node.nodeKey);
    await execution.save();
    return { done: true, wait: false };
  }

  execution.currentNodeKey = nextNodeKey;
  return { done: false, wait: false };
};

const runExecution = async (
  execution: FlowExecution,
  flowVersion: FlowVersion,
  context: RuntimeContext
): Promise<boolean> => {
  const compiled = getCompiledFlow(flowVersion);
  if (!compiled || !compiled.startNodeKey) {
    await appendExecutionEvent(execution, "invalid_compiled_flow", execution.currentNodeKey);
    execution.status = "failed";
    execution.finishedAt = new Date();
    await execution.save();
    return false;
  }

  let hops = 0;

  while (hops < 30) {
    hops += 1;

    const result = await applyNode(compiled, execution, context);

    execution.lastInteractionAt = new Date();
    execution.lockVersion = Number(execution.lockVersion || 0) + 1;
    await execution.save();

    if (result.done || result.wait) {
      return true;
    }
  }

  execution.status = "failed";
  execution.finishedAt = new Date();
  await appendExecutionEvent(execution, "max_hops_exceeded", execution.currentNodeKey, { hops });
  await execution.save();

  return false;
};

const findBindingForTicket = async (ticket: Ticket, companyId: number): Promise<FlowBinding | null> => {
  const bindings = await FlowBinding.findAll({
    where: {
      companyId,
      isActive: true,
      channel: "whatsapp",
      event: "inbound_message",
      [Op.and]: [
        {
          [Op.or]: [
            { whatsappId: null },
            { whatsappId: ticket.whatsappId }
          ]
        },
        {
          [Op.or]: [
            { queueId: null },
            { queueId: ticket.queueId }
          ]
        }
      ]
    },
    include: [
      {
        model: Flow,
        where: {
          companyId,
          status: {
            [Op.in]: ["active", "draft", "inactive"]
          }
        },
        required: true
      },
      {
        model: FlowVersion,
        where: {
          companyId,
          state: "published"
        },
        required: true
      }
    ],
    order: [["priority", "ASC"], ["id", "ASC"]]
  });

  return bindings[0] || null;
};

class FlowRuntimeService {
  public static async tryHandleInbound({
    companyId,
    ticket,
    inputText
  }: RuntimeContext): Promise<boolean> {
    if (!ticket || ticket.companyId !== companyId) {
      return false;
    }

    const ticketWhatsappId = Number(ticket.whatsappId || 0);
    if (!ticketWhatsappId) {
      return false;
    }

    const whatsapp = await Whatsapp.findOne({
      where: {
        id: ticketWhatsappId,
        companyId
      },
      attributes: ["id", "flowAutomationEnabled"]
    });

    if (!whatsapp || !Boolean((whatsapp as any).flowAutomationEnabled)) {
      const staleExecution = await FlowExecution.findOne({
        where: {
          companyId,
          ticketId: ticket.id,
          status: {
            [Op.in]: ["running", "waiting_input", "waiting_timeout"]
          }
        },
        order: [["id", "DESC"]]
      });

      if (staleExecution) {
        await appendExecutionEvent(staleExecution, "execution_stopped_whatsapp_flow_disabled", staleExecution.currentNodeKey, {
          whatsappId: ticketWhatsappId
        });
        staleExecution.status = "completed";
        staleExecution.finishedAt = new Date();
        staleExecution.lastInteractionAt = new Date();
        await staleExecution.save();
      }

      return false;
    }

    const activeExecution = await FlowExecution.findOne({
      where: {
        companyId,
        ticketId: ticket.id,
        status: {
          [Op.in]: ["running", "waiting_input", "waiting_timeout"]
        }
      },
      include: [
        {
          model: FlowVersion,
          where: { companyId },
          required: true
        }
      ],
      order: [["id", "DESC"]]
    });

    let bindingFromSupersede: FlowBinding | null = null;

    if (activeExecution) {
      const flowVersion = (activeExecution as any).flowVersion as FlowVersion;

      if (activeExecution.status !== "running") {
        const latestBinding = await findBindingForTicket(ticket, companyId);
        const latestBindingVersionId = Number(latestBinding?.flowVersionId || 0);
        const activeExecutionVersionId = Number(activeExecution.flowVersionId || 0);

        if (
          latestBinding &&
          latestBindingVersionId > 0 &&
          activeExecutionVersionId > 0 &&
          latestBindingVersionId !== activeExecutionVersionId
        ) {
          await appendExecutionEvent(activeExecution, "execution_superseded_by_binding", activeExecution.currentNodeKey, {
            fromFlowVersionId: activeExecutionVersionId,
            toFlowVersionId: latestBindingVersionId,
            bindingId: latestBinding.id
          });

          activeExecution.status = "completed";
          activeExecution.finishedAt = new Date();
          activeExecution.lastInteractionAt = new Date();
          await activeExecution.save();

          bindingFromSupersede = latestBinding;
        }
      }

      if (!bindingFromSupersede) {
        if (activeExecution.status === "waiting_timeout") {
          if (activeExecution.waitUntil && new Date(activeExecution.waitUntil).getTime() > Date.now()) {
            await appendExecutionEvent(activeExecution, "waiting_timeout_skip", activeExecution.currentNodeKey, {
              waitUntil: activeExecution.waitUntil
            });
            return true;
          }

          activeExecution.status = "running";
        }

        return runExecution(activeExecution, flowVersion, {
          companyId,
          ticket,
          inputText
        });
      }
    }

    if (ticket.userId) {
      return false;
    }

    const binding = bindingFromSupersede || await findBindingForTicket(ticket, companyId);
    if (!binding) {
      return false;
    }

    const flowVersion = (binding as any).flowVersion as FlowVersion;
    if (!flowVersion) {
      return false;
    }

    const compiled = getCompiledFlow(flowVersion);
    if (!compiled || !compiled.startNodeKey) {
      return false;
    }

    const execution = await FlowExecution.create({
      companyId,
      flowId: binding.flowId,
      flowVersionId: flowVersion.id,
      contactId: ticket.contactId,
      ticketId: ticket.id,
      whatsappId: ticket.whatsappId,
      currentNodeKey: compiled.startNodeKey,
      status: "running",
      attemptCount: 0,
      lockVersion: 0,
      startedAt: new Date(),
      lastInteractionAt: new Date(),
      contextJson: {
        source: "flow_binding",
        bindingId: binding.id,
        menuAttempts: {}
      }
    });

    await appendExecutionEvent(execution, "execution_started", compiled.startNodeKey, {
      flowId: binding.flowId,
      flowVersionId: flowVersion.id,
      bindingId: binding.id
    });

    return runExecution(execution, flowVersion, {
      companyId,
      ticket,
      inputText
    });
  }
}

export default FlowRuntimeService;

