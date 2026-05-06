import { Request, Response } from "express";
import { Op } from "sequelize";

import db from "../database";
import AppError from "../errors/AppError";

import Flow from "../models/Flow";
import FlowVersion from "../models/FlowVersion";
import FlowNode from "../models/FlowNode";
import FlowEdge from "../models/FlowEdge";
import FlowBinding from "../models/FlowBinding";
import FlowExecution from "../models/FlowExecution";
import FlowExecutionEvent from "../models/FlowExecutionEvent";
import Queue from "../models/Queue";
import Whatsapp from "../models/Whatsapp";
import Ticket from "../models/Ticket";
import buildBackendBaseUrl from "../helpers/buildBackendBaseUrl";

import { compileGraph } from "../services/FlowServices/FlowCompiler";
import {
  assertValidGraph,
  loadAndValidateVersionGraph,
  validateGraphData
} from "../services/FlowServices/FlowGraphValidator";
import FlowRuntimeService from "../services/FlowServices/FlowRuntimeService";

const ensureAdmin = (req: Request): void => {
  if (req.user.profile !== "admin" && !(req as any).user?.super) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

const normalizeNode = (node: any): any => {
  const nodeKey = String(node?.nodeKey || node?.id || "").trim();
  return {
    nodeKey,
    nodeType: String(node?.nodeType || node?.type || "").trim(),
    label: String(node?.label || nodeKey || "Nó").trim(),
    positionX: Number(node?.positionX ?? node?.position?.x ?? 0),
    positionY: Number(node?.positionY ?? node?.position?.y ?? 0),
    configJson: node?.configJson || node?.config || {}
  };
};

const normalizeEdge = (edge: any): any => {
  return {
    sourceNodeKey: String(edge?.sourceNodeKey || edge?.source || "").trim(),
    sourceHandle: edge?.sourceHandle ? String(edge.sourceHandle).trim() : null,
    targetNodeKey: String(edge?.targetNodeKey || edge?.target || "").trim(),
    conditionType: edge?.conditionType ? String(edge.conditionType).trim() : null,
    conditionValue: edge?.conditionValue ? String(edge.conditionValue).trim() : null,
    priority: Number(edge?.priority || 0)
  };
};

const buildMenuOptionsFromEdges = (nodeKey: string, edges: any[]): any[] => {
  const handles = Array.from(
    new Set(
      (edges || [])
        .filter((edge) => String(edge?.sourceNodeKey || "") === nodeKey)
        .map((edge) => String(edge?.sourceHandle || edge?.conditionValue || "").trim())
        .filter((handle) => handle && !["default", "fallback", "else", "true", "false"].includes(handle))
    )
  );

  return handles.map((handle) => ({
    id: handle,
    label: `Opcao ${handle}`,
    keywords: []
  }));
};

const getFlowById = async (flowId: number, companyId: number): Promise<Flow> => {
  const flow = await Flow.findOne({ where: { id: flowId, companyId } });
  if (!flow) {
    throw new AppError("Fluxo não encontrado", 404);
  }
  return flow;
};

const getVersionById = async (
  flowId: number,
  versionId: number,
  companyId: number
): Promise<FlowVersion> => {
  const version = await FlowVersion.findOne({
    where: {
      id: versionId,
      flowId,
      companyId
    }
  });

  if (!version) {
    throw new AppError("Versão do fluxo não encontrada", 404);
  }

  return version;
};

const ensureScopedQueue = async (queueId: number | null, companyId: number): Promise<void> => {
  if (!queueId) {
    return;
  }

  const queue = await Queue.findOne({ where: { id: queueId, companyId } });
  if (!queue) {
    throw new AppError("Fila inválida para esta empresa", 400);
  }
};

const ensureScopedWhatsapp = async (whatsappId: number | null, companyId: number): Promise<void> => {
  if (!whatsappId) {
    return;
  }

  const whatsapp = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });
  if (!whatsapp) {
    throw new AppError("Canal WhatsApp inválido para esta empresa", 400);
  }
};

export const listFlows = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { searchParam = "", status } = req.query as any;

  const where: any = {
    companyId,
    name: {
      [Op.like]: `%${String(searchParam)}%`
    }
  };

  if (status) {
    where.status = status;
  } else {
    where.status = {
      [Op.ne]: "archived"
    };
  }

  const flows = await Flow.findAll({
    where,
    include: [
      {
        model: FlowVersion,
        required: false
      },
      {
        model: FlowBinding,
        required: false
      }
    ],
    order: [["updatedAt", "DESC"]]
  });

  return res.status(200).json(flows);
};

export const createFlow = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId, id: userId } = req.user;
  const { name, description } = req.body;

  if (!name || !String(name).trim()) {
    throw new AppError("Nome do fluxo é obrigatório", 400);
  }

  const transaction = await db.transaction();

  try {
    const flow = await Flow.create(
      {
        companyId,
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        status: "draft",
        createdBy: userId,
        updatedBy: userId
      },
      { transaction }
    );

    const startNode = {
      nodeKey: "start_1",
      nodeType: "start",
      label: "Início",
      positionX: 80,
      positionY: 80,
      configJson: {}
    };

    const endNode = {
      nodeKey: "end_1",
      nodeType: "end",
      label: "Fim",
      positionX: 420,
      positionY: 80,
      configJson: {
        farewellMessage: "",
        closeTicket: false
      }
    };

    const initialEdges = [
      {
        sourceNodeKey: "start_1",
        sourceHandle: "default",
        targetNodeKey: "end_1",
        conditionType: "default",
        conditionValue: null,
        priority: 0
      }
    ];

    const compiled = compileGraph([startNode, endNode], initialEdges);

    const version = await FlowVersion.create(
      {
        flowId: flow.id,
        companyId,
        version: 1,
        state: "draft",
        graphJson: {
          nodes: [startNode, endNode],
          edges: initialEdges
        },
        compiledJson: compiled
      },
      { transaction }
    );

    await FlowNode.bulkCreate(
      [startNode, endNode].map((node) => ({
        flowVersionId: version.id,
        ...node
      })),
      { transaction }
    );

    await FlowEdge.bulkCreate(
      initialEdges.map((edge) => ({
        flowVersionId: version.id,
        ...edge
      })),
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({ flow, version });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const showFlow = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const flowId = Number(req.params.flowId);

  const flow = await Flow.findOne({
    where: { id: flowId, companyId },
    include: [
      {
        model: FlowVersion,
        as: "versions",
        separate: true,
        order: [["version", "DESC"]],
        include: [FlowNode, FlowEdge],
        required: false
      },
      {
        model: FlowBinding,
        as: "bindings",
        required: false
      }
    ]
  });

  if (!flow) {
    throw new AppError("Fluxo não encontrado", 404);
  }

  return res.status(200).json(flow);
};

export const updateFlow = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId, id: userId } = req.user;
  const flowId = Number(req.params.flowId);
  const { name, description, status } = req.body;

  const flow = await getFlowById(flowId, companyId);

  const patch: any = {
    updatedBy: userId
  };

  if (name != null) {
    patch.name = String(name).trim();
  }

  if (description != null) {
    patch.description = String(description).trim();
  }

  if (status != null) {
    patch.status = String(status);
  }

  await flow.update(patch);

  return res.status(200).json(flow);
};

export const archiveFlow = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId, id: userId } = req.user;
  const flowId = Number(req.params.flowId);
  const flow = await getFlowById(flowId, companyId);

  await flow.update({
    status: "archived",
    updatedBy: userId,
    activeVersionId: null
  });

  await FlowBinding.update(
    { isActive: false },
    {
      where: {
        flowId,
        companyId
      }
    }
  );

  return res.status(200).json({ success: true });
};

export const duplicateFlow = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId, id: userId } = req.user;
  const flowId = Number(req.params.flowId);

  const originalFlow = await Flow.findOne({
    where: { id: flowId, companyId },
    include: [
      {
        model: FlowVersion,
        as: "versions",
        separate: true,
        order: [["version", "ASC"]],
        include: [FlowNode, FlowEdge],
        required: false
      },
      {
        model: FlowBinding,
        as: "bindings",
        required: false
      }
    ]
  });

  if (!originalFlow) {
    throw new AppError("Fluxo não encontrado", 404);
  }

  const versions = ((originalFlow as any).versions || []) as FlowVersion[];
  const bindings = ((originalFlow as any).bindings || []) as FlowBinding[];

  const transaction = await db.transaction();

  try {
    const newFlow = await Flow.create(
      {
        companyId,
        name: `${originalFlow.name} (Cópia)`,
        description: originalFlow.description,
        status: "draft",
        createdBy: userId,
        updatedBy: userId
      },
      { transaction }
    );

    const versionMap = new Map<number, number>();

    for (const version of versions) {
      const newVersion = await FlowVersion.create(
        {
          flowId: newFlow.id,
          companyId,
          version: version.version,
          state: "draft",
          graphJson: version.graphJson,
          compiledJson: version.compiledJson
        },
        { transaction }
      );

      versionMap.set(version.id, newVersion.id);

      const nodes = ((version as any).nodes || []) as FlowNode[];
      const edges = ((version as any).edges || []) as FlowEdge[];

      if (nodes.length) {
        await FlowNode.bulkCreate(
          nodes.map((node) => ({
            flowVersionId: newVersion.id,
            nodeKey: node.nodeKey,
            nodeType: node.nodeType,
            label: node.label,
            positionX: node.positionX,
            positionY: node.positionY,
            configJson: node.configJson
          })),
          { transaction }
        );
      }

      if (edges.length) {
        await FlowEdge.bulkCreate(
          edges.map((edge) => ({
            flowVersionId: newVersion.id,
            sourceNodeKey: edge.sourceNodeKey,
            sourceHandle: edge.sourceHandle,
            targetNodeKey: edge.targetNodeKey,
            conditionType: edge.conditionType,
            conditionValue: edge.conditionValue,
            priority: edge.priority
          })),
          { transaction }
        );
      }
    }

    if (originalFlow.activeVersionId && versionMap.has(originalFlow.activeVersionId)) {
      await newFlow.update(
        {
          activeVersionId: versionMap.get(originalFlow.activeVersionId),
          status: "inactive"
        },
        { transaction }
      );
    }

    if (bindings.length) {
      await FlowBinding.bulkCreate(
        bindings
          .filter((binding) => versionMap.has(binding.flowVersionId))
          .map((binding) => ({
            companyId,
            flowId: newFlow.id,
            flowVersionId: versionMap.get(binding.flowVersionId),
            channel: binding.channel,
            event: binding.event,
            whatsappId: binding.whatsappId,
            queueId: binding.queueId,
            keywordStart: binding.keywordStart,
            priority: binding.priority,
            isActive: false
          })),
        { transaction }
      );
    }

    await transaction.commit();

    return res.status(201).json(newFlow);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const uploadFlowMedia = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId } = req.user;
  const flowId = Number(req.params.flowId);
  await getFlowById(flowId, companyId);

  const file = (req as any).file as Express.Multer.File | undefined;

  if (!file) {
    throw new AppError("Arquivo nao enviado.", 400);
  }

  const normalizedPath = String(file.path || "").replace(/\\/g, "/");
  const marker = "/public/";
  const markerIdx = normalizedPath.lastIndexOf(marker);
  const mediaPath =
    markerIdx >= 0
      ? normalizedPath.substring(markerIdx + marker.length)
      : `flow-media/${companyId}/${file.filename}`;

  const backendBase = buildBackendBaseUrl();
  const mediaUrl = backendBase
    ? `${backendBase}/public/${mediaPath}`
    : `/public/${mediaPath}`;

  return res.status(200).json({
    fileName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    mediaPath,
    mediaUrl
  });
};

export const listFlowVersions = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const flowId = Number(req.params.flowId);

  await getFlowById(flowId, companyId);

  const versions = await FlowVersion.findAll({
    where: { flowId, companyId },
    include: [FlowNode, FlowEdge],
    order: [["version", "DESC"]]
  });

  return res.status(200).json(versions);
};

export const createFlowVersion = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId } = req.user;
  const flowId = Number(req.params.flowId);

  await getFlowById(flowId, companyId);

  const lastVersion = await FlowVersion.findOne({
    where: { flowId, companyId },
    order: [["version", "DESC"]]
  });

  const newVersionNumber = Number(lastVersion?.version || 0) + 1;

  const version = await FlowVersion.create({
    flowId,
    companyId,
    version: newVersionNumber,
    state: "draft",
    graphJson: lastVersion?.graphJson || { nodes: [], edges: [] },
    compiledJson: lastVersion?.compiledJson || null
  });

  return res.status(201).json(version);
};

export const saveFlowGraph = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId } = req.user;
  const flowId = Number(req.params.flowId);
  const versionId = Number(req.params.versionId);
  const { nodes = [], edges = [] } = req.body;

  await getFlowById(flowId, companyId);
  const version = await getVersionById(flowId, versionId, companyId);

  if (version.state !== "draft") {
    throw new AppError("Somente versão draft pode ser editada", 400);
  }

  const normalizedNodes = (Array.isArray(nodes) ? nodes : []).map(normalizeNode);
  const normalizedEdges = (Array.isArray(edges) ? edges : []).map(normalizeEdge);

  normalizedNodes.forEach((node) => {
    if (String(node?.nodeType || "") !== "menu") return;

    const config = node?.configJson && typeof node.configJson === "object" ? { ...node.configJson } : {};
    const options = Array.isArray(config.options) ? config.options : [];

    if (options.length > 0) {
      config.options = options
        .map((option: any) => ({
          id: String(option?.id || "").trim(),
          label: String(option?.label || option?.id || "").trim(),
          keywords: Array.isArray(option?.keywords) ? option.keywords : []
        }))
        .filter((option: any) => option.id);
    }

    if (!Array.isArray(config.options) || config.options.length === 0) {
      config.options = buildMenuOptionsFromEdges(node.nodeKey, normalizedEdges);
    }

    if (!config.fallback || typeof config.fallback !== "object") {
      config.fallback = {
        message: "Opção inválida. Tente novamente.",
        nextHandle: "fallback",
        maxAttempts: 2
      };
    }

    node.configJson = config;
  });

  const errors = validateGraphData(normalizedNodes, normalizedEdges);

  const transaction = await db.transaction();

  try {
    await FlowNode.destroy({ where: { flowVersionId: version.id }, transaction });
    await FlowEdge.destroy({ where: { flowVersionId: version.id }, transaction });

    if (normalizedNodes.length) {
      await FlowNode.bulkCreate(
        normalizedNodes.map((node) => ({
          flowVersionId: version.id,
          ...node
        })),
        { transaction }
      );
    }

    if (normalizedEdges.length) {
      await FlowEdge.bulkCreate(
        normalizedEdges.map((edge) => ({
          flowVersionId: version.id,
          ...edge
        })),
        { transaction }
      );
    }

    const compiled = compileGraph(normalizedNodes, normalizedEdges);

    await version.update(
      {
        graphJson: {
          nodes: normalizedNodes,
          edges: normalizedEdges
        },
        compiledJson: compiled
      },
      { transaction }
    );

    await transaction.commit();

    return res.status(200).json({
      version,
      valid: errors.length === 0,
      errors
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const validateFlowVersion = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const flowId = Number(req.params.flowId);
  const versionId = Number(req.params.versionId);

  await getFlowById(flowId, companyId);
  await getVersionById(flowId, versionId, companyId);

  const { errors } = await loadAndValidateVersionGraph(versionId);

  return res.status(200).json({
    valid: errors.length === 0,
    errors
  });
};

export const publishFlowVersion = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId, id: userId } = req.user;
  const flowId = Number(req.params.flowId);
  const versionId = Number(req.params.versionId);
  const activate = req.body?.activate !== false;

  const flow = await getFlowById(flowId, companyId);
  const version = await getVersionById(flowId, versionId, companyId);

  const { nodes, edges, errors } = await loadAndValidateVersionGraph(versionId);
  assertValidGraph(errors);

  const compiled = compileGraph(nodes, edges);

  await version.update({
    state: "published",
    publishedAt: new Date(),
    publishedBy: userId,
    graphJson: {
      nodes,
      edges
    },
    compiledJson: compiled
  });

  if (activate) {
    await flow.update({
      activeVersionId: version.id,
      status: "active",
      updatedBy: userId
    });
  }

  return res.status(200).json({
    flow,
    version,
    activated: activate
  });
};

export const activateFlow = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId, id: userId } = req.user;
  const flowId = Number(req.params.flowId);
  const { versionId } = req.body;

  const flow = await getFlowById(flowId, companyId);
  const version = await getVersionById(flowId, Number(versionId), companyId);

  if (version.state !== "published") {
    throw new AppError("Apenas versões publicadas podem ser ativadas", 400);
  }

  await flow.update({
    activeVersionId: version.id,
    status: "active",
    updatedBy: userId
  });

  return res.status(200).json(flow);
};

export const deactivateFlow = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId, id: userId } = req.user;
  const flowId = Number(req.params.flowId);
  const flow = await getFlowById(flowId, companyId);

  await flow.update({
    status: "inactive",
    updatedBy: userId,
    activeVersionId: null
  });

  await FlowBinding.update(
    { isActive: false },
    {
      where: {
        flowId,
        companyId
      }
    }
  );

  return res.status(200).json(flow);
};

export const createFlowBinding = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId } = req.user;
  const flowId = Number(req.params.flowId);

  await getFlowById(flowId, companyId);

  const {
    flowVersionId,
    channel = "whatsapp",
    event = "inbound_message",
    whatsappId = null,
    queueId = null,
    keywordStart = null,
    priority = 0,
    isActive = true
  } = req.body;

  const version = await FlowVersion.findOne({
    where: {
      id: Number(flowVersionId),
      flowId,
      companyId,
      state: "published"
    }
  });

  if (!version) {
    throw new AppError("Versão publicada inválida para vinculação", 400);
  }

  await ensureScopedWhatsapp(whatsappId ? Number(whatsappId) : null, companyId);
  await ensureScopedQueue(queueId ? Number(queueId) : null, companyId);

  const binding = await FlowBinding.create({
    companyId,
    flowId,
    flowVersionId: Number(flowVersionId),
    channel,
    event,
    whatsappId: whatsappId ? Number(whatsappId) : null,
    queueId: queueId ? Number(queueId) : null,
    keywordStart,
    priority: Number(priority || 0),
    isActive: Boolean(isActive)
  });

  return res.status(201).json(binding);
};

export const updateFlowBinding = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId } = req.user;
  const flowId = Number(req.params.flowId);
  const bindingId = Number(req.params.bindingId);

  await getFlowById(flowId, companyId);

  const binding = await FlowBinding.findOne({
    where: {
      id: bindingId,
      flowId,
      companyId
    }
  });

  if (!binding) {
    throw new AppError("Vinculação não encontrada", 404);
  }

  const payload: any = {};

  if (req.body.flowVersionId != null) {
    const version = await FlowVersion.findOne({
      where: {
        id: Number(req.body.flowVersionId),
        flowId,
        companyId,
        state: "published"
      }
    });

    if (!version) {
      throw new AppError("Versão publicada inválida para vinculação", 400);
    }

    payload.flowVersionId = Number(req.body.flowVersionId);
  }

  if (req.body.channel != null) payload.channel = String(req.body.channel);
  if (req.body.event != null) payload.event = String(req.body.event);
  if (req.body.keywordStart != null) payload.keywordStart = String(req.body.keywordStart);
  if (req.body.priority != null) payload.priority = Number(req.body.priority || 0);
  if (req.body.isActive != null) payload.isActive = Boolean(req.body.isActive);

  if (req.body.whatsappId !== undefined) {
    const whatsappId = req.body.whatsappId ? Number(req.body.whatsappId) : null;
    await ensureScopedWhatsapp(whatsappId, companyId);
    payload.whatsappId = whatsappId;
  }

  if (req.body.queueId !== undefined) {
    const queueId = req.body.queueId ? Number(req.body.queueId) : null;
    await ensureScopedQueue(queueId, companyId);
    payload.queueId = queueId;
  }

  await binding.update(payload);

  return res.status(200).json(binding);
};

export const deleteFlowBinding = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const { companyId } = req.user;
  const flowId = Number(req.params.flowId);
  const bindingId = Number(req.params.bindingId);

  const binding = await FlowBinding.findOne({
    where: {
      id: bindingId,
      flowId,
      companyId
    }
  });

  if (!binding) {
    throw new AppError("Vinculação não encontrada", 404);
  }

  await binding.destroy();

  return res.status(200).json({ success: true });
};

export const getCurrentExecution = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const ticketId = Number(req.query.ticketId);

  if (!ticketId) {
    throw new AppError("ticketId é obrigatório", 400);
  }

  const execution = await FlowExecution.findOne({
    where: {
      companyId,
      ticketId,
      status: {
        [Op.in]: ["running", "waiting_input", "waiting_timeout", "paused_human"]
      }
    },
    order: [["id", "DESC"]]
  });

  return res.status(200).json(execution || null);
};

export const getExecutionEvents = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const executionId = Number(req.params.executionId);

  const execution = await FlowExecution.findOne({
    where: {
      id: executionId,
      companyId
    }
  });

  if (!execution) {
    throw new AppError("Execução não encontrada", 404);
  }

  const events = await FlowExecutionEvent.findAll({
    where: {
      executionId,
      companyId
    },
    order: [["id", "ASC"]]
  });

  return res.status(200).json(events);
};

export const processExecutionInput = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const executionId = Number(req.params.executionId);
  const inputText = String(req.body?.inputText || "");

  if (!inputText.trim()) {
    throw new AppError("inputText é obrigatório", 400);
  }

  const execution = await FlowExecution.findOne({
    where: {
      id: executionId,
      companyId
    }
  });

  if (!execution) {
    throw new AppError("Execução não encontrada", 404);
  }

  const ticket = await Ticket.findOne({
    where: {
      id: execution.ticketId,
      companyId
    },
    include: ["contact"]
  });

  if (!ticket) {
    throw new AppError("Ticket da execução não encontrado", 404);
  }

  const handled = await FlowRuntimeService.tryHandleInbound({
    companyId,
    ticket,
    inputText
  });

  return res.status(200).json({ handled });
};

