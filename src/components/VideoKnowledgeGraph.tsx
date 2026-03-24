"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { VideoGraph, GraphSegment, GraphNode } from "@/lib/video-graph";

interface Props {
  graph: VideoGraph;
  onSegmentClick: (segment: GraphSegment) => void;
  selectedSegmentIds: Set<string>;
  onSegmentSelect: (id: string, selected: boolean) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function speakerColor(speakerId: string | null): { border: string; bg: string; badge: string } {
  if (speakerId === "Speaker 0" || speakerId === "0")
    return { border: "#7c3aed", bg: "#2e1065", badge: "bg-violet-700" };
  if (speakerId === "Speaker 1" || speakerId === "1")
    return { border: "#2563eb", bg: "#172554", badge: "bg-blue-700" };
  if (speakerId === "Speaker 2" || speakerId === "2")
    return { border: "#16a34a", bg: "#052e16", badge: "bg-green-700" };
  return { border: "#4b5563", bg: "#111827", badge: "bg-gray-700" };
}

function edgeColor(type: string): string {
  switch (type) {
    case "logical-flow":
      return "#6b7280";
    case "setup-payoff":
      return "#7c3aed";
    case "claim-proof":
      return "#2563eb";
    case "contrast":
      return "#ea580c";
    case "problem-solution":
      return "#16a34a";
    default:
      return "#6b7280";
  }
}

function formatRelType(type: string): string {
  return type.replace(/-/g, " → ").replace("→ ", "→ ");
}

// ─── Custom node types ────────────────────────────────────────────────────────

interface StartNodeData extends Record<string, unknown> {
  label: string;
}

function StartNode(_: NodeProps<Node<StartNodeData>>) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white text-xs"
      style={{
        width: 64,
        height: 64,
        background: "#1f2937",
        border: "2px solid #6b7280",
      }}
    >
      START
    </div>
  );
}

interface TopicNodeData extends Record<string, unknown> {
  node: GraphNode;
}

function TopicNode({ data }: NodeProps<Node<TopicNodeData>>) {
  const { node } = data;
  const colors = speakerColor(node.speakerId);
  const size = node.importance >= 80 ? "text-sm" : node.importance >= 50 ? "text-xs" : "text-xs";

  return (
    <div
      className="rounded-xl px-3 py-2.5 flex flex-col gap-1"
      style={{
        width: 220,
        background: colors.bg,
        border: `2px solid ${colors.border}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-full text-white ${colors.badge}`}
        >
          {node.importance}
        </span>
        <p className={`font-bold text-white leading-tight ${size} flex-1 min-w-0`}>{node.label}</p>
      </div>
      <p className="text-gray-400 text-xs leading-snug line-clamp-2">{node.summary}</p>
    </div>
  );
}

interface SegmentNodeData extends Record<string, unknown> {
  segment: GraphSegment;
  selected: boolean;
  onSegmentClick: (segment: GraphSegment) => void;
  onSegmentSelect: (id: string, selected: boolean) => void;
}

function SegmentNode({ data }: NodeProps<Node<SegmentNodeData>>) {
  const { segment, selected, onSegmentClick, onSegmentSelect } = data;

  return (
    <div
      className="rounded-lg px-3 py-2 flex flex-col gap-1.5 cursor-pointer transition-all"
      style={{
        width: 200,
        background: "#111827",
        border: selected ? "2px solid #7c3aed" : "1px solid #374151",
        boxShadow: selected ? "0 0 0 2px #7c3aed44" : undefined,
      }}
      onClick={() => onSegmentClick(segment)}
    >
      <div className="flex items-center gap-2">
        <div
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onSegmentSelect(segment.id, !selected);
          }}
        >
          <input
            type="checkbox"
            readOnly
            checked={selected}
            className="w-3.5 h-3.5 accent-violet-500 cursor-pointer"
          />
        </div>
        <p className="text-gray-200 text-xs leading-snug line-clamp-2 flex-1">
          {segment.hookSentence}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
        <span>
          {formatTime(segment.start)} → {formatTime(segment.end)}
        </span>
        <span className="ml-auto shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-300">
          {segment.intensityScore}
        </span>
      </div>
    </div>
  );
}

const nodeTypes = {
  start: StartNode,
  topic: TopicNode,
  segment: SegmentNode,
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function VideoKnowledgeGraph({
  graph,
  onSegmentClick,
  selectedSegmentIds,
  onSegmentSelect,
}: Props) {
  // Build nodes: Start node → topic nodes left-to-right → segment nodes below each topic
  const initialNodes = useMemo<Node[]>(() => {
    const TOPIC_X_STEP = 320; // horizontal gap between topic columns
    const TOPIC_Y = 80; // row for topic nodes
    const SEG_Y_START = 230; // row for first segment under a topic
    const SEG_Y_STEP = 170; // vertical gap between stacked segments
    const START_X = 0;
    const FIRST_TOPIC_X = 140; // leave room for the start node

    const topicPositions: Record<string, { x: number; y: number }> = {};

    // Start node
    const startNode: Node = {
      id: "__start__",
      type: "start",
      position: { x: START_X, y: TOPIC_Y + 10 },
      data: { label: "START" } as StartNodeData,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };

    // Topic nodes — laid out left-to-right in the order Gemini produced them
    const topicNodes: Node[] = graph.nodes.map((node, i) => {
      const x = FIRST_TOPIC_X + i * TOPIC_X_STEP;
      topicPositions[node.id] = { x, y: TOPIC_Y };
      return {
        id: node.id,
        type: "topic",
        position: { x, y: TOPIC_Y },
        data: { node } as TopicNodeData,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    // Group segments by topicId (preserve insertion order)
    const segsByTopic: Record<string, GraphSegment[]> = {};
    for (const seg of graph.segments) {
      if (!segsByTopic[seg.topicId]) segsByTopic[seg.topicId] = [];
      segsByTopic[seg.topicId].push(seg);
    }

    const segmentNodes: Node[] = graph.segments.map((segment) => {
      const parentPos = topicPositions[segment.topicId] ?? { x: 0, y: TOPIC_Y };
      const siblings = segsByTopic[segment.topicId] ?? [];
      const idx = siblings.indexOf(segment);
      return {
        id: segment.id,
        type: "segment",
        position: {
          x: parentPos.x,
          y: SEG_Y_START + idx * SEG_Y_STEP,
        },
        data: {
          segment,
          selected: selectedSegmentIds.has(segment.id),
          onSegmentClick,
          onSegmentSelect,
        } as SegmentNodeData,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    return [startNode, ...topicNodes, ...segmentNodes];
  }, [graph, selectedSegmentIds, onSegmentClick, onSegmentSelect]);

  const initialEdges = useMemo<Edge[]>(() => {
    const arrowMarker = {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
    };

    // Start → first topic
    const startEdges: Edge[] =
      graph.nodes.length > 0
        ? [
            {
              id: "start-to-first",
              source: "__start__",
              target: graph.nodes[0].id,
              markerEnd: { ...arrowMarker, color: "#6b7280" },
              style: { stroke: "#6b7280", strokeWidth: 1.5 },
            },
          ]
        : [];

    // Topic → next topic (sequential flow)
    const topicChainEdges: Edge[] = graph.nodes.slice(0, -1).map((node, i) => ({
      id: `topic-chain-${i}`,
      source: node.id,
      target: graph.nodes[i + 1].id,
      markerEnd: { ...arrowMarker, color: "#4b5563" },
      style: { stroke: "#4b5563", strokeWidth: 1.5 },
    }));

    // Topic → its segments (structural, vertical drop)
    const structuralEdges: Edge[] = graph.segments.map((seg) => ({
      id: `topic-${seg.topicId}-${seg.id}`,
      source: seg.topicId,
      target: seg.id,
      markerEnd: { ...arrowMarker, color: "#374151" },
      style: { stroke: "#374151", strokeWidth: 1, strokeDasharray: "4 3" },
      animated: false,
    }));

    // Semantic edges between segments
    const semanticEdges: Edge[] = graph.edges.map((edge, i) => {
      const color = edgeColor(edge.relationshipType);
      return {
        id: `edge-${i}-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        animated: true,
        markerEnd: { ...arrowMarker, color },
        label: formatRelType(edge.relationshipType),
        labelStyle: { fill: color, fontSize: 10 },
        style: { stroke: color, strokeWidth: 1.5 },
      };
    });

    return [...startEdges, ...topicChainEdges, ...structuralEdges, ...semanticEdges];
  }, [graph]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Keep segment selected state in sync when selectedSegmentIds changes
  const nodesWithSelection = useMemo(() => {
    return nodes.map((node) => {
      if (node.type !== "segment") return node;
      const seg = (node.data as SegmentNodeData).segment;
      const selected = selectedSegmentIds.has(seg.id);
      if ((node.data as SegmentNodeData).selected === selected) return node;
      return {
        ...node,
        data: {
          ...(node.data as SegmentNodeData),
          selected,
          onSegmentClick,
          onSegmentSelect,
        },
      };
    });
  }, [nodes, selectedSegmentIds, onSegmentClick, onSegmentSelect]);

  return (
    <div className="relative w-full h-full bg-gray-950">
      <ReactFlow
        nodes={nodesWithSelection}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#374151" gap={20} size={1} />
        <Controls className="!bg-gray-900 !border-gray-700 !text-gray-300" />
      </ReactFlow>
    </div>
  );
}
