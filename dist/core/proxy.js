const $iter = '$Iter';
export function createProxy(client, address, returnType = 'promise') {
    return new Proxy(function () { }, {
        apply(_, __, args) {
            if (returnType === 'promise') {
                return client.functionRef(address)(...args);
            }
            else if (returnType === 'observable') {
                return client.functionObservableRef(address)(...args);
            }
            return client.functionGenRef(address)(...args);
        },
        get(_, prop) {
            if (prop === 'then') {
                const promise = client.fieldRef(address).get();
                return promise.then.bind(promise);
            }
            const [type, addressProp] = prop.endsWith($iter)
                ? ['gen', prop.slice(0, -1 * $iter.length)]
                : prop.endsWith('$')
                    ? ['observable', prop.slice(0, -1)]
                    : ['promise', prop];
            const applyProxy = createProxy(client, `${address}/${addressProp}`, type);
            return applyProxy;
        },
    });
}
