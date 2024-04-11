export default class TrieWithPrefix {
    constructor(_splitKey = (key) => key.split('/'), _joinKey = (fragments) => fragments.join('/')) {
        this._splitKey = _splitKey;
        this._joinKey = _joinKey;
        this._root = {};
        this._valueMap = new WeakMap();
    }
    set(key, value, wildcard = false) {
        const fragments = this._splitKey(key);
        let node = this._root;
        for (const next of fragments) {
            const nextNode = node[next];
            if (!nextNode) {
                node[next] = {};
            }
            node = node[next];
        }
        this._valueMap.set(node, { value, wildcard });
    }
    delete(key) {
        const fragments = this._splitKey(key);
        let node = this._root;
        for (const next of fragments) {
            const nextNode = node[next];
            if (!nextNode) {
                break;
            }
            else {
                node = nextNode;
            }
        }
        if (node) {
            this._valueMap.delete(node);
        }
    }
    list(prefix = "") {
        const fragments = this._splitKey(prefix);
        let node = this._root;
        for (const next of fragments) {
            const nextNode = node[next];
            if (!nextNode) {
                return [];
            }
            else {
                node = nextNode;
            }
        }
        const result = [];
        const stack = [[prefix, node]];
        while (stack.length > 0) {
            const [currentAddress, currentNode] = stack.shift();
            if (this._valueMap.has(currentNode)) {
                result.push(currentAddress);
            }
            for (const key in currentNode) {
                const nextNode = currentNode[key];
                const nextAddress = this._joinKey([currentAddress, key]);
                stack.push([nextAddress, nextNode]);
            }
        }
        return result;
    }
    get(key) {
        const fragments = this._splitKey(key);
        let node = this._root;
        let closestWildCardNode = undefined;
        for (const next of fragments) {
            const nextNode = node[next];
            if (!nextNode) {
                node = closestWildCardNode;
                break;
            }
            else {
                node = nextNode;
                if (this._valueMap.get(node)?.wildcard) {
                    closestWildCardNode = node;
                }
            }
        }
        node = node ?? closestWildCardNode;
        return node && this._valueMap.get(node)?.value;
    }
}
