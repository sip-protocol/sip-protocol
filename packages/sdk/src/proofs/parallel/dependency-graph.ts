/**
 * Dependency Graph Analyzer for Parallel Proof Generation
 *
 * @module proofs/parallel/dependency-graph
 * @description Analyzes proof dependencies and determines optimal execution order
 *
 * M20-12: Optimize proof generation parallelization (#307)
 */

import type {
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  GraphAnalysis,
  IDependencyAnalyzer,
} from './interface'

// ─── Dependency Analyzer Implementation ──────────────────────────────────────

/**
 * Analyzes proof dependencies and builds execution graphs
 */
export class DependencyAnalyzer implements IDependencyAnalyzer {
  /**
   * Analyze a set of proof requests and build dependency graph
   */
  analyze(nodes: DependencyNode[]): GraphAnalysis {
    // Build the graph
    const nodeMap = new Map<string, DependencyNode>()
    const edges: DependencyEdge[] = []
    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()

    // Index all nodes
    for (const node of nodes) {
      nodeMap.set(node.id, node)
      inDegree.set(node.id, 0)
      outDegree.set(node.id, 0)
    }

    // Build edges and calculate degrees
    for (const node of nodes) {
      for (const depId of node.dependencies) {
        if (nodeMap.has(depId)) {
          edges.push({
            from: depId,
            to: node.id,
            connectionType: 'proof', // Default connection type
          })
          inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1)
          outDegree.set(depId, (outDegree.get(depId) ?? 0) + 1)
        }
      }
    }

    // Find roots (no incoming edges)
    const roots: string[] = []
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        roots.push(id)
      }
    }

    // Find leaves (no outgoing edges)
    const leaves: string[] = []
    for (const [id, degree] of outDegree) {
      if (degree === 0) {
        leaves.push(id)
      }
    }

    // Detect cycles using DFS
    const cycleResult = this.detectCycles(nodeMap, edges)

    // Calculate depths and find critical path
    const depths = this.calculateDepths(nodeMap, edges)
    const maxDepth = Math.max(0, ...Array.from(depths.values()))

    // Find critical path (longest weighted path)
    const criticalPath = this.findCriticalPath(nodeMap, edges, depths)

    // Calculate total cost
    let totalCost = 0
    for (const node of nodes) {
      totalCost += node.estimatedCost
    }

    const graph: DependencyGraph = {
      nodes: nodeMap,
      edges,
      roots,
      leaves,
      maxDepth,
      totalCost,
      criticalPath,
    }

    // Calculate execution levels
    const executionLevels = this.calculateExecutionLevels(graph)

    // Find bottlenecks (high cost nodes on critical path)
    const bottlenecks = this.findBottlenecks(graph, criticalPath)

    // Suggest parallelism based on graph structure
    const suggestedParallelism = this.suggestParallelism(graph, executionLevels)

    return {
      graph,
      suggestedParallelism,
      executionLevels,
      hasCycles: cycleResult.hasCycles,
      cyclePath: cycleResult.cyclePath,
      bottlenecks,
    }
  }

  /**
   * Add a node to an existing graph
   */
  addNode(graph: DependencyGraph, node: DependencyNode): DependencyGraph {
    const newNodes = new Map(graph.nodes)
    newNodes.set(node.id, node)

    // Add edges for dependencies
    const newEdges = [...graph.edges]
    for (const depId of node.dependencies) {
      if (newNodes.has(depId)) {
        newEdges.push({
          from: depId,
          to: node.id,
          connectionType: 'proof',
        })
      }
    }

    // Recalculate graph properties
    const roots = this.calculateRoots(newNodes, newEdges)
    const leaves = this.calculateLeaves(newNodes, newEdges)
    const depths = this.calculateDepths(newNodes, newEdges)
    const maxDepth = Math.max(0, ...Array.from(depths.values()))
    const criticalPath = this.findCriticalPath(newNodes, newEdges, depths)

    let totalCost = 0
    for (const n of newNodes.values()) {
      totalCost += n.estimatedCost
    }

    return {
      nodes: newNodes,
      edges: newEdges,
      roots,
      leaves,
      maxDepth,
      totalCost,
      criticalPath,
    }
  }

  /**
   * Remove a node from the graph
   */
  removeNode(graph: DependencyGraph, nodeId: string): DependencyGraph {
    const newNodes = new Map(graph.nodes)
    newNodes.delete(nodeId)

    // Remove edges involving this node
    const newEdges = graph.edges.filter((e) => e.from !== nodeId && e.to !== nodeId)

    // Recalculate graph properties
    const roots = this.calculateRoots(newNodes, newEdges)
    const leaves = this.calculateLeaves(newNodes, newEdges)
    const depths = this.calculateDepths(newNodes, newEdges)
    const maxDepth = Math.max(0, ...Array.from(depths.values()))
    const criticalPath = this.findCriticalPath(newNodes, newEdges, depths)

    let totalCost = 0
    for (const n of newNodes.values()) {
      totalCost += n.estimatedCost
    }

    return {
      nodes: newNodes,
      edges: newEdges,
      roots,
      leaves,
      maxDepth,
      totalCost,
      criticalPath,
    }
  }

  /**
   * Get execution order respecting dependencies (topological sort)
   */
  getExecutionOrder(graph: DependencyGraph): readonly string[] {
    const result: string[] = []
    const visited = new Set<string>()
    const inProgress = new Set<string>()

    const visit = (nodeId: string): boolean => {
      if (inProgress.has(nodeId)) {
        // Cycle detected
        return false
      }
      if (visited.has(nodeId)) {
        return true
      }

      inProgress.add(nodeId)
      const node = graph.nodes.get(nodeId)
      if (node) {
        for (const depId of node.dependencies) {
          if (graph.nodes.has(depId)) {
            if (!visit(depId)) {
              return false
            }
          }
        }
      }
      inProgress.delete(nodeId)
      visited.add(nodeId)
      result.push(nodeId)
      return true
    }

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId)
      }
    }

    return result
  }

  /**
   * Find nodes ready to execute (all dependencies satisfied)
   */
  getReadyNodes(graph: DependencyGraph, completed: Set<string>): readonly string[] {
    const ready: string[] = []

    for (const [nodeId, node] of graph.nodes) {
      if (completed.has(nodeId)) {
        continue
      }

      // Check if all dependencies are satisfied
      let allDependenciesSatisfied = true
      for (const depId of node.dependencies) {
        if (graph.nodes.has(depId) && !completed.has(depId)) {
          allDependenciesSatisfied = false
          break
        }
      }

      if (allDependenciesSatisfied) {
        ready.push(nodeId)
      }
    }

    // Sort by priority (higher first), then by cost (lower first for better parallelism)
    ready.sort((a, b) => {
      const nodeA = graph.nodes.get(a)!
      const nodeB = graph.nodes.get(b)!
      const priorityDiff = (nodeB.priority ?? 0) - (nodeA.priority ?? 0)
      if (priorityDiff !== 0) return priorityDiff
      return nodeA.estimatedCost - nodeB.estimatedCost
    })

    return ready
  }

  /**
   * Validate graph is acyclic
   */
  validateAcyclic(graph: DependencyGraph): boolean {
    const result = this.detectCycles(graph.nodes, graph.edges)
    return !result.hasCycles
  }

  // ─── Private Helper Methods ──────────────────────────────────────────────────

  private detectCycles(
    nodes: Map<string, DependencyNode>,
    edges: DependencyEdge[]
  ): { hasCycles: boolean; cyclePath?: string[] } {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const path: string[] = []

    // Build adjacency list
    const adjacency = new Map<string, string[]>()
    for (const node of nodes.keys()) {
      adjacency.set(node, [])
    }
    for (const edge of edges) {
      adjacency.get(edge.from)?.push(edge.to)
    }

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId)
      recursionStack.add(nodeId)
      path.push(nodeId)

      for (const neighbor of adjacency.get(nodeId) ?? []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true
          }
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          path.push(neighbor)
          return true
        }
      }

      recursionStack.delete(nodeId)
      path.pop()
      return false
    }

    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) {
          // Extract cycle from path
          const cycleStart = path.indexOf(path[path.length - 1])
          const cyclePath = path.slice(cycleStart)
          return { hasCycles: true, cyclePath }
        }
      }
    }

    return { hasCycles: false }
  }

  private calculateDepths(
    nodes: Map<string, DependencyNode>,
    edges: DependencyEdge[]
  ): Map<string, number> {
    const depths = new Map<string, number>()
    const inDegree = new Map<string, number>()

    // Initialize
    for (const nodeId of nodes.keys()) {
      depths.set(nodeId, 0)
      inDegree.set(nodeId, 0)
    }

    // Count in-degrees
    for (const edge of edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
    }

    // BFS from roots
    const queue: string[] = []
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId)
        depths.set(nodeId, 0)
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!
      const currentDepth = depths.get(current) ?? 0

      for (const edge of edges) {
        if (edge.from === current) {
          const newDepth = Math.max(depths.get(edge.to) ?? 0, currentDepth + 1)
          depths.set(edge.to, newDepth)

          const newInDegree = (inDegree.get(edge.to) ?? 1) - 1
          inDegree.set(edge.to, newInDegree)

          if (newInDegree === 0) {
            queue.push(edge.to)
          }
        }
      }
    }

    return depths
  }

  private findCriticalPath(
    nodes: Map<string, DependencyNode>,
    edges: DependencyEdge[],
    depths: Map<string, number>
  ): readonly string[] {
    if (nodes.size === 0) {
      return []
    }

    // Build reverse adjacency (to traverse backwards from leaves)
    const reverseAdj = new Map<string, string[]>()
    for (const nodeId of nodes.keys()) {
      reverseAdj.set(nodeId, [])
    }
    for (const edge of edges) {
      reverseAdj.get(edge.to)?.push(edge.from)
    }

    // Calculate cumulative cost from each node to any leaf
    const costToLeaf = new Map<string, number>()
    const pathToLeaf = new Map<string, string[]>()

    // Find leaves
    const outDegree = new Map<string, number>()
    for (const nodeId of nodes.keys()) {
      outDegree.set(nodeId, 0)
    }
    for (const edge of edges) {
      outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1)
    }

    const leaves: string[] = []
    for (const [nodeId, degree] of outDegree) {
      if (degree === 0) {
        leaves.push(nodeId)
        const node = nodes.get(nodeId)!
        costToLeaf.set(nodeId, node.estimatedCost)
        pathToLeaf.set(nodeId, [nodeId])
      }
    }

    // Process nodes in reverse topological order
    const sortedNodes = Array.from(nodes.keys()).sort(
      (a, b) => (depths.get(b) ?? 0) - (depths.get(a) ?? 0)
    )

    for (const nodeId of sortedNodes) {
      if (costToLeaf.has(nodeId)) continue

      const node = nodes.get(nodeId)!
      let maxCost = 0
      let bestPath: string[] = [nodeId]

      // Find successor with maximum cost to leaf
      for (const edge of edges) {
        if (edge.from === nodeId) {
          const successorCost = costToLeaf.get(edge.to) ?? 0
          if (successorCost > maxCost) {
            maxCost = successorCost
            bestPath = [nodeId, ...(pathToLeaf.get(edge.to) ?? [])]
          }
        }
      }

      costToLeaf.set(nodeId, node.estimatedCost + maxCost)
      pathToLeaf.set(nodeId, bestPath)
    }

    // Find root with maximum cost to leaf
    let maxTotalCost = 0
    let criticalPath: string[] = []

    for (const nodeId of nodes.keys()) {
      const inDeg = edges.filter((e) => e.to === nodeId).length
      if (inDeg === 0) {
        const totalCost = costToLeaf.get(nodeId) ?? 0
        if (totalCost > maxTotalCost) {
          maxTotalCost = totalCost
          criticalPath = pathToLeaf.get(nodeId) ?? []
        }
      }
    }

    return criticalPath
  }

  private calculateExecutionLevels(graph: DependencyGraph): readonly string[][] {
    const levels: string[][] = []
    const completed = new Set<string>()

    while (completed.size < graph.nodes.size) {
      const ready = this.getReadyNodes(graph, completed)
      if (ready.length === 0) {
        // No more nodes ready (cycle or all done)
        break
      }

      levels.push([...ready])
      for (const nodeId of ready) {
        completed.add(nodeId)
      }
    }

    return levels
  }

  private findBottlenecks(graph: DependencyGraph, criticalPath: readonly string[]): readonly string[] {
    if (criticalPath.length === 0) {
      return []
    }

    // Calculate average cost
    let totalCost = 0
    for (const node of graph.nodes.values()) {
      totalCost += node.estimatedCost
    }
    const avgCost = totalCost / graph.nodes.size

    // Bottlenecks are critical path nodes with above-average cost
    const bottlenecks: string[] = []
    for (const nodeId of criticalPath) {
      const node = graph.nodes.get(nodeId)
      if (node && node.estimatedCost > avgCost * 1.5) {
        bottlenecks.push(nodeId)
      }
    }

    return bottlenecks
  }

  private suggestParallelism(_graph: DependencyGraph, levels: readonly string[][]): number {
    if (levels.length === 0) {
      return 1
    }

    // Suggested parallelism is the maximum level width
    let maxWidth = 1
    for (const level of levels) {
      maxWidth = Math.max(maxWidth, level.length)
    }

    // Cap at reasonable maximum
    return Math.min(maxWidth, 8)
  }

  private calculateRoots(
    nodes: Map<string, DependencyNode>,
    edges: DependencyEdge[]
  ): readonly string[] {
    const hasIncoming = new Set<string>()
    for (const edge of edges) {
      hasIncoming.add(edge.to)
    }

    const roots: string[] = []
    for (const nodeId of nodes.keys()) {
      if (!hasIncoming.has(nodeId)) {
        roots.push(nodeId)
      }
    }

    return roots
  }

  private calculateLeaves(
    nodes: Map<string, DependencyNode>,
    edges: DependencyEdge[]
  ): readonly string[] {
    const hasOutgoing = new Set<string>()
    for (const edge of edges) {
      hasOutgoing.add(edge.from)
    }

    const leaves: string[] = []
    for (const nodeId of nodes.keys()) {
      if (!hasOutgoing.has(nodeId)) {
        leaves.push(nodeId)
      }
    }

    return leaves
  }
}

/**
 * Create a dependency analyzer instance
 */
export function createDependencyAnalyzer(): IDependencyAnalyzer {
  return new DependencyAnalyzer()
}

/**
 * Create a dependency node
 */
export function createDependencyNode(
  id: string,
  circuitId: string,
  system: DependencyNode['system'],
  options: {
    dependencies?: string[]
    estimatedCost?: number
    estimatedMemory?: number
    privateInputs?: Record<string, unknown>
    publicInputs?: Record<string, unknown>
    priority?: number
  } = {}
): DependencyNode {
  return {
    id,
    circuitId,
    system,
    dependencies: options.dependencies ?? [],
    estimatedCost: options.estimatedCost ?? 100,
    estimatedMemory: options.estimatedMemory ?? 64 * 1024 * 1024, // 64MB default
    privateInputs: options.privateInputs ?? {},
    publicInputs: options.publicInputs ?? {},
    priority: options.priority,
  }
}
