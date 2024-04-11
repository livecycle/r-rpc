export function createMemoryChannel(input, output) {
    const onCall = (fn) => {
        input.on('request', (data) => {
            fn(JSON.parse(data));
        });
    };
    const respond = async (result) => {
        output.emit('response_' + result.correlationId, JSON.stringify(result));
    };
    const send = async (call, cb) => {
        const eventId = 'response_' + call.correlationId;
        if (input.listenerCount(eventId) > 0) {
            input.removeAllListeners(eventId);
        }
        input.on(eventId, function f(result) {
            const res = JSON.parse(result);
            if (res.type === 'error' || res.done) {
                input.off(eventId, f);
            }
            cb(res);
        });
        output.emit('request', JSON.stringify(call));
    };
    return {
        onCall,
        respond,
        send,
    };
}
