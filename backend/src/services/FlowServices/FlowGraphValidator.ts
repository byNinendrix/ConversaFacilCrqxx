import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import FlowNode from "../../models/FlowNode";
import FlowEdge from "../../models/FlowEdge";

export interface GraphValidationError {
  code: string;
  message: string;
  nodeKey?: string;
  edgeId?: number;
}

const getNodeKey = (node: any): string => {
  return String(node?.nodeKey || node?.id || "").trim();
};

const getNodeType = (node: any): string => {
  return String(node?.nodeType || node?.type || "").trim();
};

const asArray = (value: any): any[] => {
  return Array.isArray(value) ? value : [];
};

const deriveMenuOptionsFromEdges = (nodeKey: string, outgoing: any[]): any[] => {
  const handles = Array.from(
    new Set(
      (outgoing || [])
        .map((edge) => String(edge?.sourceHandle || edge?.conditionValue || "").trim())
        .filter((handle) => handle && !["default", "fallback", "else", "true", "false"].includes(handle))
    )
  );

  return handles.map((handle) => ({
    id: handle,
    label: `Opcao ${handle}`
  }));
};

export const validateGraphData = (nodes: any[], edges: any[]): GraphValidationError[] => {
  const errors: GraphValidationError[] = [];

  if (!nodes.length) {
    errors.push({ code: "NO_NODES", message: "Fluxo sem nós." });
    return errors;
  }

  const normalizedNodes = nodes.map((node) => ({
    ...node,
    nodeKey: getNodeKey(node),
    nodeType: getNodeType(node)
  }));

  const startNodes = normalizedNodes.filter((node) => node.nodeType === "start");

  if (startNodes.length === 0) {
    errors.push({ code: "MISSING_START", message: "Fluxo deve possuir um nó inicial (start)." });
  }

  if (startNodes.length > 1) {
    errors.push({ code: "MULTIPLE_START", message: "Fluxo deve possuir apenas um nó inicial (start)." });
  }

  const nodeKeySet = new Set<string>();
  for (const node of normalizedNodes) {
    if (!node.nodeKey) {
      errors.push({ code: "NODE_KEY_EMPTY", message: "Nó sem identificador." });
      continue;
    }

    if (nodeKeySet.has(node.nodeKey)) {
      errors.push({ code: "NODE_KEY_DUPLICATE", message: `Identificador duplicado: ${node.nodeKey}`, nodeKey: node.nodeKey });
    }

    nodeKeySet.add(node.nodeKey);
  }

  for (const edge of edges) {
    if (!nodeKeySet.has(String(edge.sourceNodeKey || ""))) {
      errors.push({
        code: "EDGE_SOURCE_INVALID",
        message: `Aresta com origem inválida: ${edge.sourceNodeKey}`,
        edgeId: edge.id
      });
    }

    if (!nodeKeySet.has(String(edge.targetNodeKey || ""))) {
      errors.push({
        code: "EDGE_TARGET_INVALID",
        message: `Aresta com destino inválido: ${edge.targetNodeKey}`,
        edgeId: edge.id
      });
    }
  }

  for (const node of normalizedNodes) {
    if (node.nodeType === "end") {
      continue;
    }

    const outgoing = edges.filter((edge) => String(edge.sourceNodeKey) === node.nodeKey);

    if (outgoing.length === 0) {
      errors.push({
        code: "NODE_WITHOUT_OUTGOING",
        message: `Nó ${node.nodeKey} não possui transição de saída.`,
        nodeKey: node.nodeKey
      });
    }

    if (node.nodeType === "menu") {
      const config = node.configJson || node.config || {};
      let options = asArray(config.options);
      if (!options.length) {
        options = deriveMenuOptionsFromEdges(node.nodeKey, outgoing);
      }

      // Para manter compatibilidade com grafos legados, não bloqueamos publicação
      // quando um menu não traz "options" explícitas. Nesse caso, o runtime pode
      // seguir por fallback/default e o editor permite evolução incremental.
      if (!options.length) {
        continue;
      }

      const optionIds = new Set(options.map((option) => String(option?.id || "").trim()).filter(Boolean));
      for (const optionId of optionIds) {
        const hasTransition = outgoing.some(
          (edge) => String(edge.sourceHandle || edge.conditionValue || "") === optionId
        );
        if (!hasTransition) {
          errors.push({
            code: "MENU_OPTION_WITHOUT_EDGE",
            message: `Opção ${optionId} do nó ${node.nodeKey} não possui transição.`,
            nodeKey: node.nodeKey
          });
        }
      }
    }

    if (node.nodeType === "condition") {
      const hasTrue = outgoing.some((edge) => String(edge.sourceHandle || "") === "true");
      const hasFalse = outgoing.some((edge) => ["false", "else", "default"].includes(String(edge.sourceHandle || "")));

      if (!hasTrue || !hasFalse) {
        errors.push({
          code: "CONDITION_BRANCH_MISSING",
          message: `Nó condicional ${node.nodeKey} deve ter saída true e false/else.`,
          nodeKey: node.nodeKey
        });
      }
    }

    if (node.nodeType === "message") {
      const config = node.configJson || node.config || {};
      const messageType = String(config?.messageType || "text").trim().toLowerCase();
      const mediaUrl = String(config?.mediaUrl || "").trim();
      const mediaPath = String(config?.mediaPath || "").trim();

      if ((messageType === "image" || messageType === "video") && !mediaUrl && !mediaPath) {
        errors.push({
          code: "MESSAGE_MEDIA_URL_REQUIRED",
          message: `No de mensagem ${node.nodeKey} requer anexo enviado para ${messageType}.`,
          nodeKey: node.nodeKey
        });
      }
    }
  }

  if (errors.length === 0 && startNodes.length === 1) {
    const visited = new Set<string>();
    const queue: string[] = [startNodes[0].nodeKey];

    while (queue.length) {
      const current = queue.shift() as string;
      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      const outgoing = edges.filter((edge) => String(edge.sourceNodeKey) === current);
      for (const edge of outgoing) {
        const target = String(edge.targetNodeKey || "");
        if (target && !visited.has(target)) {
          queue.push(target);
        }
      }
    }

    for (const node of normalizedNodes) {
      if (!visited.has(node.nodeKey)) {
        errors.push({
          code: "UNREACHABLE_NODE",
          message: `Nó ${node.nodeKey} não é alcançável a partir do início.`,
          nodeKey: node.nodeKey
        });
      }
    }
  }

  return errors;
};

export const loadAndValidateVersionGraph = async (flowVersionId: number): Promise<{ nodes: FlowNode[]; edges: FlowEdge[]; errors: GraphValidationError[] }> => {
  const nodes = await FlowNode.findAll({
    where: { flowVersionId },
    order: [["id", "ASC"]]
  });

  const edges = await FlowEdge.findAll({
    where: { flowVersionId },
    order: [["priority", "ASC"], ["id", "ASC"]]
  });

  const errors = validateGraphData(nodes, edges);

  return { nodes, edges, errors };
};

export const assertValidGraph = (errors: GraphValidationError[]): void => {
  if (errors.length) {
    throw new AppError("Fluxo inválido. Corrija os erros antes de publicar.", 400);
  }
};

