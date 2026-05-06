import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, FormControl, Grid, InputLabel, MenuItem, Paper, Select, TextField, Typography, makeStyles } from "@material-ui/core";
import { toast } from "react-toastify";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import useFlows from "../../hooks/useFlows";
import api from "../../services/api";

const W = 240;
const H = 32;
const CW = 2400;
const CH = 1300;
const META = {
  start: { c: "#2563eb", l: "Inicio" },
  message: { c: "#0284c7", l: "Mensagem" },
  menu: { c: "#7c3aed", l: "Menu" },
  condition: { c: "#d97706", l: "Condicao" },
  queue_transfer: { c: "#059669", l: "Transferir" },
  end: { c: "#dc2626", l: "Fim" }
};
const S = makeStyles((t) => ({
  r: { flex: 1, width: "100%" },
  b: { ...t.scrollbarStyles, overflowY: "auto", padding: 8, width: "100%" },
  p: { padding: 12, borderRadius: 14, border: `1px solid ${t.palette.divider}` },
  f: { width: "100%", justifyContent: "space-between", marginBottom: 8, textTransform: "none" },
  fs: { background: "rgba(16,185,129,.12)" },
  row: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  rowScroll: { display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 4, marginBottom: 8, ...t.scrollbarStyles },
  toolbar: {
    position: "sticky",
    top: 0,
    zIndex: 4,
    background: t.palette.background.paper,
    backdropFilter: "blur(6px)",
    paddingTop: 4,
    paddingBottom: 4,
    borderBottom: `1px solid ${t.palette.divider}`,
    marginBottom: 10
  },
  cv: {
    position: "relative",
    border: `1px solid ${t.palette.divider}`,
    borderRadius: 12,
    height: "calc(100vh - 225px)",
    minHeight: 720,
    overflow: "auto",
    background: t.palette.type === "dark" ? "#0f172a" : "#f8fafc"
  },
  cs: {
    position: "relative",
    backgroundImage: "linear-gradient(to right, rgba(148,163,184,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,.18) 1px, transparent 1px)",
    backgroundSize: "24px 24px"
  },
  n: { position: "absolute", width: W, borderRadius: 10, border: `1px solid ${t.palette.divider}`, background: t.palette.type === "dark" ? "#111827" : "#fff", boxShadow: "0 8px 24px rgba(2,8,23,.16)" },
  ns: { boxShadow: "0 0 0 2px rgba(6,182,212,.55), 0 10px 24px rgba(2,8,23,.22)" },
  h: { height: H, borderTopLeftRadius: 9, borderTopRightRadius: 9, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 10px", fontWeight: 700, cursor: "grab" },
  nb: { padding: 10, fontSize: 12, color: t.palette.text.secondary },
  hi: { position: "absolute", left: -7, width: 12, height: 12, borderRadius: 20, border: "2px solid #0ea5e9", background: "#fff", cursor: "crosshair" },
  ho: { position: "absolute", right: -7, width: 12, height: 12, borderRadius: 20, border: "2px solid #7c3aed", background: "#fff", cursor: "crosshair" },
  ht: { position: "absolute", right: 12, fontSize: 11, color: t.palette.text.secondary },
  i: {
    borderRadius: 12,
    border: `1px solid ${t.palette.divider}`,
    padding: 12,
    minHeight: "calc(100vh - 225px)",
    maxHeight: "calc(100vh - 225px)",
    overflowY: "auto",
    background: t.palette.background.paper
  },
  statusChip: { fontWeight: 700, letterSpacing: ".01em" },
  edgeSvg: { position: "absolute", top: 0, left: 0, pointerEvents: "none" },
  edge: { fill: "none", stroke: "#38bdf8", strokeWidth: 2.2, pointerEvents: "auto", cursor: "pointer" },
  edgeSelected: { stroke: "#f59e0b", strokeWidth: 3.2 },
  paletteFloat: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 5,
    width: 152,
    padding: 8,
    borderRadius: 12,
    border: `1px solid ${t.palette.divider}`,
    background: t.palette.type === "dark" ? "rgba(15,23,42,.88)" : "rgba(255,255,255,.92)",
    boxShadow: "0 8px 24px rgba(2,8,23,.18)"
  },
  paletteCollapsed: { width: 46, padding: 6 },
  paletteTitle: { fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 8, color: t.palette.text.secondary },
  paletteBtn: { marginBottom: 6, textTransform: "none", justifyContent: "flex-start" },
  canvasQuick: { position: "absolute", bottom: 12, right: 12, zIndex: 5, display: "flex", gap: 6, padding: 8, borderRadius: 12, border: `1px solid ${t.palette.divider}`, background: t.palette.type === "dark" ? "rgba(15,23,42,.88)" : "rgba(255,255,255,.92)" }
}));

const out = (n) => (n.type === "menu" ? ((n.cfg?.options || []).map((o) => `${o.id || ""}`.trim()).filter(Boolean).concat(n.cfg?.fallback?.nextHandle ? [n.cfg.fallback.nextHandle] : []) || ["default"]) : n.type === "end" ? [] : ["default"]);
const nh = (n) => 88 + Math.max(out(n).length, 1) * 20;
const oy = (n, h) => H + 42 + Math.max(out(n).indexOf(h), 0) * 20;
const iy = (n) => nh(n) / 2;
const bez = (sx, sy, tx, ty) => `M ${sx} ${sy} C ${sx + 90} ${sy}, ${tx - 90} ${ty}, ${tx} ${ty}`;
const previewMessageNode = (cfg) => {
  const messageType = `${cfg?.messageType || "text"}`.trim().toLowerCase();
  if (messageType === "image") {
    const name = cfg?.mediaName || cfg?.mediaPath || cfg?.mediaUrl || "";
    return name ? `Imagem: ${name}` : "Imagem sem arquivo";
  }
  if (messageType === "video") {
    const name = cfg?.mediaName || cfg?.mediaPath || cfg?.mediaUrl || "";
    return name ? `Video: ${name}` : "Video sem arquivo";
  }
  return cfg?.text || "";
};
const parseN = (a) => (a || []).map((n, i) => ({ id: `${n.nodeKey || `node_${i + 1}`}`, type: META[n.nodeType] ? n.nodeType : "message", label: `${n.label || "Bloco"}`, pos: { x: Number(n.positionX ?? 120), y: Number(n.positionY ?? 80) }, cfg: n.configJson || {} }));
const parseE = (a) => (a || []).map((e, i) => ({ id: `${e.sourceNodeKey}-${e.sourceHandle || "default"}-${e.targetNodeKey}-${i}`, s: `${e.sourceNodeKey}`, sh: `${e.sourceHandle || "default"}`, t: `${e.targetNodeKey}` }));
const sanitizeMenuConfig = (node, edges) => {
  const cfg = node?.cfg && typeof node.cfg === "object" ? { ...node.cfg } : {};
  const optionsRaw = Array.isArray(cfg.options) ? cfg.options : [];
  const parsedOptions = optionsRaw
    .map((opt) => ({
      id: `${opt?.id || ""}`.trim(),
      label: `${opt?.label || opt?.id || ""}`.trim(),
      keywords: Array.isArray(opt?.keywords) ? opt.keywords : []
    }))
    .filter((opt) => opt.id);

  if (parsedOptions.length > 0) {
    cfg.options = parsedOptions;
    return cfg;
  }

  const outgoingHandles = (edges || [])
    .filter((edge) => edge.s === node.id)
    .map((edge) => `${edge.sh || "default"}`.trim())
    .filter(Boolean);

  const optionHandles = Array.from(new Set(outgoingHandles.filter((handle) => !["default", "fallback", "else", "true", "false"].includes(handle))));
  cfg.options = optionHandles.map((handle) => ({
    id: handle,
    label: `Opcao ${handle}`,
    keywords: []
  }));

  if (!cfg.fallback || typeof cfg.fallback !== "object") {
    cfg.fallback = { message: "Opcao invalida.", nextHandle: "fallback" };
  }

  return cfg;
};

const ser = (ns, es) => {
  const grp = {};
  es.forEach((e) => { if (!grp[e.s]) grp[e.s] = []; grp[e.s].push(e); });
  const edges = [];
  Object.keys(grp).forEach((s) => grp[s].forEach((e, i) => edges.push({ sourceNodeKey: s, sourceHandle: e.sh || "default", targetNodeKey: e.t, conditionType: "default", conditionValue: e.sh !== "default" ? e.sh : null, priority: i })));
  return {
    nodes: ns.map((n) => ({
      nodeKey: n.id,
      nodeType: n.type,
      label: n.label,
      positionX: Math.round(n.pos.x),
      positionY: Math.round(n.pos.y),
      configJson:
        n.type === "menu"
          ? sanitizeMenuConfig(n, es)
          : n.cfg || {}
    })),
    edges
  };
};

const Flows = () => {
  const c = S();
  const { listFlows, createFlow, showFlow, createVersion, saveGraph, validateVersion, publishVersion, activateFlow, deactivateFlow, duplicateFlow, deleteFlow, uploadFlowMedia } = useFlows();
  const [loading, setLoading] = useState(false); const [zoom, setZoom] = useState(1);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [queues, setQueues] = useState([]);
  const [flows, setFlows] = useState([]); const [flowId, setFlowId] = useState(null); const [verId, setVerId] = useState("");
  const [nodes, setNodes] = useState(parseN([{ nodeKey: "start_1", nodeType: "start", label: "Inicio", positionX: 120, positionY: 90, configJson: {} }, { nodeKey: "end_1", nodeType: "end", label: "Fim", positionX: 460, positionY: 90, configJson: { farewellMessage: "" } }]));
  const [edges, setEdges] = useState(parseE([{ sourceNodeKey: "start_1", sourceHandle: "default", targetNodeKey: "end_1" }]));
  const [selN, setSelN] = useState(null); const [selE, setSelE] = useState(null); const [conn, setConn] = useState(null); const [drag, setDrag] = useState(null); const [errs, setErrs] = useState([]);
  const canvasRef = useRef(null);
  const mediaInputRef = useRef(null);
  const flow = useMemo(() => flows.find((f) => f.id === flowId) || null, [flows, flowId]);
  const ver = useMemo(() => (flow?.versions || []).find((v) => v.id === Number(verId)) || null, [flow, verId]);
  const sn = useMemo(() => nodes.find((n) => n.id === selN) || null, [nodes, selN]);
  const map = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const queueNameById = useMemo(() => {
    const m = new Map();
    (queues || []).forEach((q) => m.set(Number(q.id), q.name));
    return m;
  }, [queues]);
  const redges = useMemo(() => edges.map((e) => {
    const s = map.get(e.s); const t = map.get(e.t); if (!s || !t) return null;
    const sx = s.pos.x + W; const sy = s.pos.y + oy(s, e.sh || "default"); const tx = t.pos.x; const ty = t.pos.y + iy(t);
    return { ...e, d: bez(sx, sy, tx, ty), lx: (sx + tx) / 2, ly: (sy + ty) / 2 - 6 };
  }), [edges, map]);

  useEffect(() => {
    if (!drag) return undefined;
    const mm = (ev) => setNodes((p) => p.map((n) => n.id !== drag.id ? n : { ...n, pos: { x: Math.max(0, Math.min(CW - W - 20, drag.ox + (ev.clientX - drag.sx) / zoom)), y: Math.max(0, Math.min(CH - nh(n) - 20, drag.oy + (ev.clientY - drag.sy) / zoom)) } }));
    const mu = () => setDrag(null);
    window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
  }, [drag, zoom]);

  const apply = (v) => {
    const g = v?.graphJson;
    const ns = parseN(Array.isArray(g?.nodes) ? g.nodes : [{ nodeKey: "start_1", nodeType: "start", label: "Inicio", positionX: 120, positionY: 90, configJson: {} }, { nodeKey: "end_1", nodeType: "end", label: "Fim", positionX: 460, positionY: 90, configJson: { farewellMessage: "" } }]);
    const es = parseE(Array.isArray(g?.edges) ? g.edges : [{ sourceNodeKey: "start_1", sourceHandle: "default", targetNodeKey: "end_1" }]);
    setNodes(ns); setEdges(es); setSelN(ns[0]?.id || null); setSelE(null); setConn(null);
  };

  const reload = async (keep = true) => {
    const data = await listFlows(); const v = (Array.isArray(data) ? data : []).filter((f) => f?.status !== "archived"); setFlows(v);
    if (!v.length) { setFlowId(null); setVerId(""); return; }
    if (!keep || !flowId || !v.some((f) => f.id === flowId)) setFlowId(v[0].id);
  };
  const details = async (id, preferredVersionId = null) => {
    setLoading(true);
    try {
      const data = await showFlow(id); setFlows((p) => p.map((f) => f.id === id ? data : f));
      const vs = Array.isArray(data?.versions) ? data.versions : [];
      const preferredId = preferredVersionId != null ? `${preferredVersionId}` : `${verId}`;
      const pick = vs.find((x) => `${x.id}` === preferredId) || vs[0] || null;
      if (pick) { setVerId(`${pick.id}`); apply(pick); } else { setVerId(""); apply(null); }
      setErrs([]);
    } catch { toast.error("Falha ao carregar fluxo."); } finally { setLoading(false); }
  };
  useEffect(() => { (async () => { setLoading(true); try { await reload(false); } catch { toast.error("Falha ao listar fluxos."); } finally { setLoading(false); } })(); }, []); // eslint-disable-line
  useEffect(() => { if (flowId) details(flowId); }, [flowId]); // eslint-disable-line
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/queue");
        setQueues(Array.isArray(data) ? data : []);
      } catch {
        setQueues([]);
      }
    })();
  }, []);
  useEffect(() => {
    if (!focusMode) return;
    setLeftCollapsed(true);
    setInspectorCollapsed(true);
    setPaletteCollapsed(false);
  }, [focusMode]);

  const mk = (t) => {
    const b = t.replace(/[^a-z0-9_]/gi, "_");
    const ids = new Set(nodes.map((n) => n.id));
    let i = 1;
    while (ids.has(`${b}_${i}`)) i += 1;
    return {
      id: `${b}_${i}`,
      type: t,
      label: `${META[t].l} ${i}`,
      pos: { x: 120, y: 80 + nodes.length * 35 },
      cfg: t === "message"
        ? { messageType: "text", text: "Nova mensagem", mediaUrl: "", mediaPath: "", mediaName: "" }
        : t === "menu"
          ? { prompt: "Digite uma opcao", options: [{ id: "1", label: "Opcao 1", keywords: [] }], fallback: { message: "Opcao invalida.", nextHandle: "fallback" } }
          : t === "queue_transfer"
            ? { queueId: null, message: "Encaminhando..." }
            : t === "end"
              ? { farewellMessage: "" }
              : {}
    };
  };
  const handleUploadMessageMedia = async (file) => {
    if (!file || !flow || !sn || sn.type !== "message") return;
    if (file.size > 40 * 1024 * 1024) {
      toast.error("Arquivo excede 40MB.");
      return;
    }

    const lowerType = `${file.type || ""}`.toLowerCase();
    const inferredMessageType = lowerType.startsWith("video/") ? "video" : "image";
    const selectedNodeId = sn.id;

    setUploadingMedia(true);
    try {
      const data = await uploadFlowMedia(flow.id, file);
      const nextNodes = nodes.map((n) => n.id === selectedNodeId ? {
        ...n,
        cfg: {
          ...(n.cfg || {}),
          messageType: inferredMessageType,
          mediaPath: data?.mediaPath || "",
          mediaUrl: data?.mediaUrl || "",
          mediaName: data?.fileName || file.name
        }
      } : n);
      setNodes(nextNodes);

      let targetVersionId = ver?.id ? Number(ver.id) : null;
      if (!targetVersionId) {
        throw new Error("VERSAO_NAO_ENCONTRADA");
      }

      if (String(ver?.state || "") !== "draft") {
        const createdDraft = await createVersion(flow.id);
        targetVersionId = Number(createdDraft.id);
        toast.info("Nova versao draft criada para salvar o anexo.");
      }

      const saveResult = await saveGraph(flow.id, targetVersionId, ser(nextNodes, edges));
      const saveErrors = Array.isArray(saveResult?.errors) ? saveResult.errors : [];
      setErrs(saveErrors);
      await details(flow.id, targetVersionId);

      if (saveErrors.length > 0) {
        toast.warn("Arquivo anexado, mas o draft possui pendencias de validacao.");
      } else {
        toast.success("Arquivo anexado ao bloco e salvo no draft.");
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || "Falha ao enviar arquivo.";
      toast.error(msg);
    } finally {
      setUploadingMedia(false);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
    }
  };
  const add = (t) => { if (t === "start" && nodes.some((n) => n.type === "start")) return toast.warn("Ja existe Inicio."); const n = mk(t); setNodes((p) => [...p, n]); setSelN(n.id); };
  const delNode = () => { if (!sn) return; if (sn.type === "start") return toast.warn("Inicio nao pode ser removido."); setNodes((p) => p.filter((n) => n.id !== sn.id)); setEdges((p) => p.filter((e) => e.s !== sn.id && e.t !== sn.id)); setSelN(null); };
  const delEdge = () => { if (!selE) return; setEdges((p) => p.filter((e) => e.id !== selE)); setSelE(null); };
  const builderCols = inspectorCollapsed ? "minmax(0,1fr)" : "minmax(0,1fr) 320px";
  const focusFlow = () => {
    if (!canvasRef.current || !nodes.length) return;
    const minX = Math.min(...nodes.map((n) => n.pos.x));
    const minY = Math.min(...nodes.map((n) => n.pos.y));
    const maxX = Math.max(...nodes.map((n) => n.pos.x + W));
    const maxY = Math.max(...nodes.map((n) => n.pos.y + nh(n)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const viewW = canvasRef.current.clientWidth;
    const viewH = canvasRef.current.clientHeight;
    canvasRef.current.scrollLeft = Math.max(0, centerX * zoom - viewW / 2);
    canvasRef.current.scrollTop = Math.max(0, centerY * zoom - viewH / 2);
  };

  return (
    <MainContainer className={c.r} maxWidth={false} disableGutters>
      <MainHeader><Title>Fluxos de Atendimento</Title></MainHeader>
      <Paper className={c.b} elevation={0}>
        <Grid container spacing={1}>
          {!leftCollapsed ? <Grid item xs={12} md={3} lg={2}>
            <Paper className={c.p}>
              <div className={c.row}>
                <Button variant="contained" color="primary" onClick={async () => { const name = window.prompt("Nome do novo fluxo:"); if (!name) return; setLoading(true); try { await createFlow({ name, description: "Fluxo visual" }); await reload(false); toast.success("Fluxo criado."); } catch { toast.error("Falha ao criar."); } finally { setLoading(false); } }} disabled={loading}>Novo Fluxo</Button>
                <Button variant="outlined" onClick={async () => { if (!flow) return; setLoading(true); try { await duplicateFlow(flow.id); await reload(false); toast.success("Fluxo duplicado."); } catch { toast.error("Falha ao duplicar."); } finally { setLoading(false); } }} disabled={!flow || loading}>Duplicar</Button>
                <Button variant="outlined" color="secondary" onClick={async () => { if (!flow) return; if (!window.confirm(`Deseja excluir "${flow.name}"?`)) return; setLoading(true); try { await deleteFlow(flow.id); await reload(false); toast.success("Fluxo excluido com sucesso."); } catch { toast.error("Falha ao excluir."); } finally { setLoading(false); } }} disabled={!flow || loading}>Excluir</Button>
              </div>
              {(flows || []).map((f) => <Button key={f.id} className={`${c.f} ${f.id === flowId ? c.fs : ""}`} variant="outlined" onClick={() => setFlowId(f.id)}><span>{f.name}</span><Chip label={f.status} size="small" /></Button>)}
            </Paper>
          </Grid> : null}
          <Grid item xs={12} md={leftCollapsed ? 12 : 9} lg={leftCollapsed ? 12 : 10}>
            <Paper className={c.p}>
              {!flow ? <Typography>Selecione um fluxo para editar.</Typography> : (
                <>
                  <div className={c.row} style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Typography variant="h6">{flow.name}</Typography>
                    <div className={c.row} style={{ marginBottom: 0 }}>
                      <Chip className={c.statusChip} size="small" label={`Nos: ${nodes.length}`} />
                      <Chip className={c.statusChip} size="small" label={`Conexoes: ${edges.length}`} />
                      <Chip className={c.statusChip} size="small" color={conn ? "primary" : "default"} label={conn ? "Conectando..." : "Pronto"} />
                    </div>
                  </div>
                  <div className={c.toolbar}>
                  <div className={c.rowScroll}>
                    <Select value={verId} onChange={(e) => { const v = `${e.target.value}`; setVerId(v); apply((flow.versions || []).find((x) => `${x.id}` === v)); }} style={{ minWidth: 220 }}>{(flow.versions || []).map((v) => <MenuItem key={v.id} value={`${v.id}`}>V{v.version} - {v.state}</MenuItem>)}</Select>
                    <Button variant="outlined" onClick={async () => { if (!flow) return; setLoading(true); try { const v = await createVersion(flow.id); await details(flow.id, v.id); toast.success("Nova versao criada."); } catch { toast.error("Falha ao criar versao."); } finally { setLoading(false); } }} disabled={loading || uploadingMedia}>Nova Versao Draft</Button>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={async () => {
                        if (!flow || !ver) return;
                        if (nodes.filter((n) => n.type === "start").length !== 1) return toast.error("Fluxo precisa de 1 Inicio.");
                        setLoading(true);
                        try {
                          let targetVersion = ver;
                          if (String(targetVersion?.state || "") !== "draft") {
                            const createdDraft = await createVersion(flow.id);
                            targetVersion = createdDraft;
                            toast.info("A versao atual nao era draft. Nova versao draft criada automaticamente.");
                          }

                          const r = await saveGraph(flow.id, targetVersion.id, ser(nodes, edges));
                          setErrs(Array.isArray(r?.errors) ? r.errors : []);
                          await details(flow.id, targetVersion.id);
                          if (Array.isArray(r?.errors) && r.errors.length > 0) {
                            toast.warn("Draft salvo com pendencias de validacao.");
                          } else {
                            toast.success("Draft salvo.");
                          }
                        } catch (err) {
                          const msg =
                            err?.response?.data?.message ||
                            err?.response?.data?.error ||
                            "Falha ao salvar.";
                          toast.error(`Falha ao salvar: ${msg}`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || uploadingMedia || !verId}
                    >
                      Salvar Draft
                    </Button>
                    <Button variant="outlined" onClick={async () => { if (!flow || !ver) return; setLoading(true); try { const r = await validateVersion(flow.id, ver.id); setErrs(Array.isArray(r?.errors) ? r.errors : []); toast[r?.valid ? "success" : "warn"](r?.valid ? "Fluxo valido." : "Fluxo com inconsistencias."); } catch { toast.error("Falha ao validar."); } finally { setLoading(false); } }} disabled={loading || !verId}>Validar</Button>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={async () => {
                        if (!flow || !ver) return;
                        setLoading(true);
                        try {
                          if (String(ver.state || "") === "draft") {
                            const saveResult = await saveGraph(flow.id, ver.id, ser(nodes, edges));
                            const saveErrors = Array.isArray(saveResult?.errors) ? saveResult.errors : [];
                            setErrs(saveErrors);
                            if (saveErrors.length > 0) {
                              toast.error("Nao foi possivel publicar: corrija os erros de validacao.");
                              return;
                            }
                          }

                          const validation = await validateVersion(flow.id, ver.id);
                          const validationErrors = Array.isArray(validation?.errors) ? validation.errors : [];
                          setErrs(validationErrors);
                          if (!validation?.valid) {
                            toast.error("Fluxo invalido para publicacao. Veja os erros abaixo.");
                            return;
                          }

                          await publishVersion(flow.id, ver.id, true);
                          await details(flow.id);
                          toast.success("Publicado + ativo.");
                        } catch (err) {
                          const msg =
                            err?.response?.data?.message ||
                            err?.response?.data?.error ||
                            "Falha ao publicar.";
                          toast.error(`Falha ao publicar: ${msg}`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || uploadingMedia || !verId}
                    >
                      Publicar + Ativar
                    </Button>
                    <Button variant="outlined" onClick={async () => { if (!flow || !ver) return; setLoading(true); try { await activateFlow(flow.id, ver.id); await details(flow.id); toast.success("Fluxo ativado."); } catch { toast.error("Falha ao ativar."); } finally { setLoading(false); } }} disabled={loading || !verId}>Ativar Versao</Button>
                    <Button variant="outlined" color="secondary" onClick={async () => { if (!flow) return; setLoading(true); try { await deactivateFlow(flow.id); await details(flow.id); toast.success("Fluxo desativado."); } catch { toast.error("Falha ao desativar."); } finally { setLoading(false); } }} disabled={loading}>Desativar</Button>
                  </div>
                  <div className={c.rowScroll}>
                    <Button size="small" variant="outlined" onClick={() => setLeftCollapsed((prev) => !prev)}>{leftCollapsed ? "Mostrar Fluxos" : "Ocultar Fluxos"}</Button>
                    <Button size="small" variant="outlined" onClick={() => setInspectorCollapsed((prev) => !prev)}>{inspectorCollapsed ? "Mostrar Propriedades" : "Ocultar Propriedades"}</Button>
                    <Button size="small" variant="outlined" onClick={() => setPaletteCollapsed((prev) => !prev)}>{paletteCollapsed ? "Mostrar Paleta" : "Ocultar Paleta"}</Button>
                    <Button
                      size="small"
                      variant={focusMode ? "contained" : "outlined"}
                      color={focusMode ? "primary" : "default"}
                      onClick={() => {
                        setFocusMode((prev) => {
                          const next = !prev;
                          if (!next) {
                            setLeftCollapsed(false);
                            setInspectorCollapsed(false);
                          }
                          return next;
                        });
                      }}
                    >
                      {focusMode ? "Sair do Modo Foco" : "Modo Foco"}
                    </Button>
                    <Button size="small" variant="outlined" onClick={focusFlow}>Focar Fluxo</Button>
                    <Button size="small" variant="outlined" onClick={delNode} disabled={!sn}>Excluir bloco</Button><Button size="small" variant="outlined" onClick={delEdge} disabled={!selE}>Excluir conexao</Button>
                    {conn ? <Chip size="small" color="primary" label={`Conectando ${conn.s}:${conn.h}`} onDelete={() => setConn(null)} /> : null}
                  </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: builderCols, gap: 10 }}>
                    <div style={{ position: "relative" }}>
                      <div className={`${c.paletteFloat} ${paletteCollapsed ? c.paletteCollapsed : ""}`}>
                        <Button className={c.paletteBtn} size="small" variant="outlined" fullWidth onClick={() => setPaletteCollapsed((prev) => !prev)}>
                          {paletteCollapsed ? ">>" : "Recolher"}
                        </Button>
                        {!paletteCollapsed ? <>
                          <Typography className={c.paletteTitle}>Blocos</Typography>
                          <Button className={c.paletteBtn} fullWidth size="small" variant="outlined" onClick={() => add("start")}>+ Inicio</Button>
                          <Button className={c.paletteBtn} fullWidth size="small" variant="outlined" onClick={() => add("message")}>+ Mensagem</Button>
                          <Button className={c.paletteBtn} fullWidth size="small" variant="outlined" onClick={() => add("menu")}>+ Menu</Button>
                          <Button className={c.paletteBtn} fullWidth size="small" variant="outlined" onClick={() => add("condition")}>+ Condicao</Button>
                          <Button className={c.paletteBtn} fullWidth size="small" variant="outlined" onClick={() => add("queue_transfer")}>+ Transferir</Button>
                          <Button className={c.paletteBtn} fullWidth size="small" variant="outlined" onClick={() => add("end")}>+ Fim</Button>
                          <Typography variant="caption" color="textSecondary">
                            Clique no ponto de saida e depois no ponto de entrada do proximo bloco.
                          </Typography>
                        </> : null}
                      </div>
                      <div className={c.cv} ref={canvasRef} onClick={() => { setSelE(null); if (conn) setConn(null); }}>
                        <div className={c.cs} style={{ width: CW, height: CH, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
                          <svg className={c.edgeSvg} width={CW} height={CH}>
                            {redges.map((e) => e ? <g key={e.id}><path className={`${c.edge} ${selE === e.id ? c.edgeSelected : ""}`} d={e.d} onClick={(ev) => { ev.stopPropagation(); setSelE(e.id); setSelN(null); }} /><text x={e.lx} y={e.ly} style={{ fontSize: 11, fill: "#475569" }}>{e.sh}</text></g> : null)}
                          </svg>
                          {nodes.map((n) => <div key={n.id} className={`${c.n} ${selN === n.id ? c.ns : ""}`} style={{ left: n.pos.x, top: n.pos.y, height: nh(n) }} onClick={(ev) => { ev.stopPropagation(); setSelN(n.id); setSelE(null); }}>
                            <div className={c.h} style={{ background: META[n.type]?.c || "#334155" }} onMouseDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); setDrag({ id: n.id, sx: ev.clientX, sy: ev.clientY, ox: n.pos.x, oy: n.pos.y }); setSelN(n.id); }}>{n.label}<small>{META[n.type]?.l || n.type}</small></div>
                            <div className={c.nb}>{n.type === "message" ? previewMessageNode(n.cfg) : n.type === "menu" ? n.cfg?.prompt : n.type === "queue_transfer" ? `Fila: ${queueNameById.get(Number(n.cfg?.queueId || 0)) || n.cfg?.queueId || "-"}` : n.type === "end" ? n.cfg?.farewellMessage : META[n.type]?.l}</div>
                            <div className={c.hi} style={{ top: iy(n) - 6 }} onMouseDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); if (!conn || conn.s === n.id) return setConn(null); setEdges((p) => [...p.filter((x) => !(x.s === conn.s && x.sh === conn.h)), { id: `${conn.s}-${conn.h}-${n.id}-${Date.now()}`, s: conn.s, sh: conn.h, t: n.id }]); setConn(null); }} />
                            {out(n).map((h, i) => <React.Fragment key={`${n.id}-${h}-${i}`}><div className={c.ho} style={{ top: oy(n, h) - 6, boxShadow: conn && conn.s === n.id && conn.h === h ? "0 0 0 4px rgba(124,58,237,.25)" : "none" }} onMouseDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); setConn({ s: n.id, h }); setSelE(null); }} /><span className={c.ht} style={{ top: oy(n, h) - 7 }}>{h}</span></React.Fragment>)}
                          </div>)}
                        </div>
                      </div>
                      <div className={c.canvasQuick}>
                        <Button size="small" variant="outlined" onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(2))))}>-</Button>
                        <Chip size="small" label={`${Math.round(zoom * 100)}%`} />
                        <Button size="small" variant="outlined" onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))))}>+</Button>
                        <Button size="small" variant="outlined" onClick={focusFlow}>Focar</Button>
                      </div>
                    </div>
                    {!inspectorCollapsed ? <div className={c.i}>
                      {!sn ? <Typography variant="body2">Selecione um bloco.</Typography> : <>
                        <Typography variant="subtitle1" style={{ marginBottom: 8 }}>Propriedades</Typography>
                        <TextField label="Tipo" value={META[sn.type]?.l || sn.type} variant="outlined" size="small" fullWidth disabled style={{ marginBottom: 8 }} />
                        <TextField label="Titulo" value={sn.label || ""} onChange={(e) => setNodes((p) => p.map((n) => n.id === sn.id ? { ...n, label: e.target.value } : n))} variant="outlined" size="small" fullWidth style={{ marginBottom: 8 }} />
                        {sn.type === "message" ? <>
                          <FormControl variant="outlined" size="small" fullWidth style={{ marginBottom: 8 }}>
                            <InputLabel id="flow-message-type-label">Tipo de envio</InputLabel>
                            <Select
                              labelId="flow-message-type-label"
                              value={sn.cfg?.messageType || "text"}
                              onChange={(e) => setNodes((p) => p.map((n) => n.id === sn.id ? {
                                ...n,
                                cfg: {
                                  ...(n.cfg || {}),
                                  messageType: e.target.value
                                }
                              } : n))}
                              label="Tipo de envio"
                            >
                              <MenuItem value="text">Texto</MenuItem>
                              <MenuItem value="image">Imagem (Upload)</MenuItem>
                              <MenuItem value="video">Video (Upload)</MenuItem>
                            </Select>
                          </FormControl>
                          {`${sn.cfg?.messageType || "text"}`.toLowerCase() !== "text" ? <>
                            <input
                              ref={mediaInputRef}
                              type="file"
                              accept={`${`${sn.cfg?.messageType || "text"}`.toLowerCase() === "video" ? "video/*" : "image/*"}`}
                              style={{ display: "none" }}
                              onChange={(e) => handleUploadMessageMedia(e.target.files?.[0])}
                            />
                            <div className={c.row} style={{ marginBottom: 8 }}>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => mediaInputRef.current?.click()}
                                disabled={uploadingMedia}
                              >
                                {uploadingMedia ? "Enviando..." : "Upload do arquivo"}
                              </Button>
                              {(sn.cfg?.mediaName || sn.cfg?.mediaPath || sn.cfg?.mediaUrl) ? <Chip
                                size="small"
                                label={`${sn.cfg?.mediaName || sn.cfg?.mediaPath || "Arquivo anexado"}`}
                                onDelete={() => setNodes((p) => p.map((n) => n.id === sn.id ? {
                                  ...n,
                                  cfg: {
                                    ...(n.cfg || {}),
                                    mediaPath: "",
                                    mediaUrl: "",
                                    mediaName: ""
                                  }
                                } : n))}
                              /> : null}
                            </div>
                            <TextField
                              label="Arquivo anexado (URL gerada)"
                              value={sn.cfg?.mediaUrl || ""}
                              variant="outlined"
                              fullWidth
                              size="small"
                              disabled
                              style={{ marginBottom: 8 }}
                            />
                          </> : null}
                          <TextField
                            label={`${sn.cfg?.messageType || "text"}`.toLowerCase() === "text" ? "Mensagem" : "Legenda (opcional)"}
                            value={sn.cfg?.text || ""}
                            onChange={(e) => setNodes((p) => p.map((n) => n.id === sn.id ? {
                              ...n,
                              cfg: {
                                ...(n.cfg || {}),
                                text: e.target.value
                              }
                            } : n))}
                            variant="outlined"
                            multiline
                            rows={4}
                            fullWidth
                          />
                        </> : null}
                        {sn.type === "menu" ? <>
                          <TextField label="Texto do menu" value={sn.cfg?.prompt || ""} onChange={(e) => setNodes((p) => p.map((n) => n.id === sn.id ? { ...n, cfg: { ...(n.cfg || {}), prompt: e.target.value } } : n))} variant="outlined" multiline rows={3} fullWidth style={{ marginBottom: 8 }} />
                          <TextField label="Opcoes (id|rotulo por linha)" value={(sn.cfg?.options || []).map((o) => `${o.id || ""}|${o.label || ""}`).join("\n")} onChange={(e) => { const options = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => { const [id, label] = x.split("|"); return { id: (id || "").trim(), label: (label || id || "").trim(), keywords: [] }; }); setNodes((p) => p.map((n) => n.id === sn.id ? { ...n, cfg: { ...(n.cfg || {}), options } } : n)); }} variant="outlined" multiline rows={6} fullWidth />
                        </> : null}
                        {sn.type === "queue_transfer" ? <>
                          <FormControl variant="outlined" size="small" fullWidth style={{ marginBottom: 8 }}>
                            <InputLabel id="flow-transfer-queue-label">Fila de destino</InputLabel>
                            <Select
                              labelId="flow-transfer-queue-label"
                              value={sn.cfg?.queueId || ""}
                              onChange={(e) => setNodes((p) => p.map((n) => n.id === sn.id ? { ...n, cfg: { ...(n.cfg || {}), queueId: e.target.value ? Number(e.target.value) : null } } : n))}
                              label="Fila de destino"
                            >
                              <MenuItem value=""><em>Selecione a fila</em></MenuItem>
                              {(queues || []).map((q) => (
                                <MenuItem key={q.id} value={q.id}>
                                  {q.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <TextField label="Mensagem de transferencia" value={sn.cfg?.message || ""} onChange={(e) => setNodes((p) => p.map((n) => n.id === sn.id ? { ...n, cfg: { ...(n.cfg || {}), message: e.target.value } } : n))} variant="outlined" multiline rows={3} fullWidth />
                        </> : null}
                        {sn.type === "end" ? <TextField label="Mensagem final" value={sn.cfg?.farewellMessage || ""} onChange={(e) => setNodes((p) => p.map((n) => n.id === sn.id ? { ...n, cfg: { ...(n.cfg || {}), farewellMessage: e.target.value } } : n))} variant="outlined" multiline rows={3} fullWidth /> : null}
                      </>}
                    </div> : null}
                  </div>
                  {errs.length > 0 ? <Paper variant="outlined" style={{ marginTop: 10, padding: 10, borderColor: "#fecaca", background: "rgba(254,226,226,.5)" }}>{errs.map((e, i) => <Typography key={`${e.code || "err"}-${i}`} variant="body2">- {e.message}</Typography>)}</Paper> : null}
                </>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Paper>
    </MainContainer>
  );
};

export default Flows;
