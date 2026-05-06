export interface CompiledNode {
  nodeKey: string;
  nodeType: string;
  label: string;
  config: any;
}

export interface CompiledEdge {
  sourceNodeKey: string;
  sourceHandle: string | null;
  targetNodeKey: string;
  conditionType: string | null;
  conditionValue: string | null;
  priority: number;
}

export interface CompiledFlow {
  startNodeKey: string | null;
  nodes: Record<string, CompiledNode>;
  edgesBySource: Record<string, CompiledEdge[]>;
}

export const compileGraph = (nodes: any[], edges: any[]): CompiledFlow => {
  const mapNodes: Record<string, CompiledNode> = {};
  const edgesBySource: Record<string, CompiledEdge[]> = {};

  let startNodeKey: string | null = null;

  for (const rawNode of nodes) {
    const nodeKey = String(rawNode.nodeKey || rawNode.id || "").trim();
    const nodeType = String(rawNode.nodeType || rawNode.type || "").trim();

    if (!nodeKey) {
      continue;
    }

    if (nodeType === "start" && !startNodeKey) {
      startNodeKey = nodeKey;
    }

    mapNodes[nodeKey] = {
      nodeKey,
      nodeType,
      label: String(rawNode.label || nodeKey),
      config: rawNode.configJson || rawNode.config || {}
    };
  }

  for (const rawEdge of edges) {
    const sourceNodeKey = String(rawEdge.sourceNodeKey || "").trim();
    const targetNodeKey = String(rawEdge.targetNodeKey || "").trim();

    if (!sourceNodeKey || !targetNodeKey) {
      continue;
    }

    const edge: CompiledEdge = {
      sourceNodeKey,
      sourceHandle: rawEdge.sourceHandle ? String(rawEdge.sourceHandle) : null,
      targetNodeKey,
      conditionType: rawEdge.conditionType ? String(rawEdge.conditionType) : null,
      conditionValue: rawEdge.conditionValue ? String(rawEdge.conditionValue) : null,
      priority: Number(rawEdge.priority || 0)
    };

    if (!edgesBySource[sourceNodeKey]) {
      edgesBySource[sourceNodeKey] = [];
    }

    edgesBySource[sourceNodeKey].push(edge);
  }

  for (const sourceNodeKey of Object.keys(edgesBySource)) {
    edgesBySource[sourceNodeKey] = edgesBySource[sourceNodeKey].sort(
      (a, b) => a.priority - b.priority
    );
  }

  return {
    startNodeKey,
    nodes: mapNodes,
    edgesBySource
  };
};

export const findNextByHandle = (
  compiled: CompiledFlow,
  nodeKey: string,
  handle?: string | null
): string | null => {
  const outgoing = compiled.edgesBySource[nodeKey] || [];

  if (handle != null) {
    const byHandle = outgoing.find(
      (edge) => String(edge.sourceHandle || "") === String(handle)
    );
    if (byHandle) {
      return byHandle.targetNodeKey;
    }
  }

  const fallback = outgoing.find(
    (edge) => ["default", "else", "fallback"].includes(String(edge.sourceHandle || ""))
  );

  if (fallback) {
    return fallback.targetNodeKey;
  }

  return outgoing.length ? outgoing[0].targetNodeKey : null;
};

