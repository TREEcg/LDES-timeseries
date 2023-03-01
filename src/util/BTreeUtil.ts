/**
 * Calculates the maximum amount of members for a given depth for a B+-TREE structure.
 * Formula: layerSize^(depth-1)xpageSize
 *
 * @param pageSize - Maximum amount of members in a leaf node.
 * @param layerSize - Maximum amount of unique nodes that can be reached from a node.
 * @param depth - depth of the TREE (only a root node is depth 1).
 * @return {number} - maximum amount of members.
 */
export function memberPerLayer(pageSize: number, layerSize: number, depth: number): number {
    if (depth < 2) {
        return 0
    }
    return Math.pow(layerSize, depth - 1) * pageSize
}

/**
 * Logs the maximum amount of members per depth
 * @param pageSize - Maximum amount of members in a leaf node.
 * @param layerSize - Maximum amount of unique nodes that can be reached from a node.
 */
export function logMaximumMembersForDepth(pageSize: number, layerSize: number): void {
    // create range (1..n)
    const range = (n: number) => Array.from(Array(n), (_, i) => i + 1)
    for (const depth of range(10)) {
        console.log(`Maximum ${memberPerLayer(pageSize,layerSize,depth)} members for depth ${depth}, layerSize ${layerSize} and pageSize ${pageSize}`);
    }
}

