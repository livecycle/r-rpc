export default class TrieWithPrefix {
    constructor(_splitKey = (key) => key.split('/'), _joinKey = (fragments) => fragments.join('/')) {
        this._splitKey = _splitKey;
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
