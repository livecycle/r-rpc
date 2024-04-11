import TrieWithPrefix from './trie';

describe('TrieWithPrefix', () => {
    let trie: TrieWithPrefix<number>;

    beforeEach(() => {
        trie = new TrieWithPrefix<number>();
    });

    it('should set and get values correctly', () => {
        trie.set('foo', 1);
        trie.set('bar', 2);
        trie.set('baz', 3);

        expect(trie.get('foo')).toBe(1);
        expect(trie.get('bar')).toBe(2);
        expect(trie.get('baz')).toBe(3);
        expect(trie.get('qux')).toBeUndefined();
    });

    it('should delete values correctly', () => {
        trie.set('foo', 1);
        trie.set('bar', 2);
        trie.set('baz', 3);

        trie.delete('bar');

        expect(trie.get('foo')).toBe(1);
        expect(trie.get('bar')).toBeUndefined();
        expect(trie.get('baz')).toBe(3);
    });

    it('should list values with prefix correctly', () => {
        trie.set('foo/bar', 1);
        trie.set('foo/baz', 2);
        trie.set('qux', 3);

        expect(trie.list('foo')).toEqual(['foo/bar', 'foo/baz']);
        expect(trie.list('qux')).toEqual(['qux']);
        expect(trie.list('baz')).toEqual([]);
    });
});
