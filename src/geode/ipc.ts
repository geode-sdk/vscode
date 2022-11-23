
import * as net from 'net';
import { getOutputChannel } from '../config';
import { Err, Future, None, Ok, Option, Some } from '../utils/monads';

export namespace ipc {
    export type MessageThen = (data: any) => void;

    interface Reply {
        reply: string,
        data: any,
    }

    interface Message {
        mod: string,
        message: string,
        reply?: string,
        data: any,
    }

    function isReply<T>(reply: T | Reply): reply is Reply {
        return 'reply' in reply && 'data' in reply;
    }

    export async function post(modID: string, msgID: string, data?: any): Promise<any> {
        if (process.platform === 'win32') {
            return new Promise((resolve, reject) => {
                const pipe = net.connect('\\\\.\\pipe\\GeodeIPCPipe', () => {
                    pipe?.write(JSON.stringify({
                        mod: modID,
                        message: msgID,
                        data,
                        reply: 'geode-vscode'
                    }));
                })
                    .on('error', err => {
                        reject('Unable to connect to Geode IPC');
                    })
                    .on('data', data => {
                        try {
                            const obj = JSON.parse(data.toString());
                            if (isReply(obj)) {
                                resolve(obj.data);
                            } else {
                                reject('Received non-reply');
                            }
                        } catch {
                            reject('Received non-JSON IPC message');
                        }
                    });
            });
        }
        return Promise.reject(`This platform doesn't support IPC yet!`);
    }
}

