/* eslint-disable unused-imports/no-unused-vars -- Message and isReply are unused experimentally */
import * as net from 'node:net';

// eslint-disable-next-line ts/no-namespace -- todo
export namespace ipc {
	export type MessageThen = (data: any) => void;

	interface Reply {
		reply: string;
		data: any;
	}

	interface Message {
		mod: string;
		message: string;
		reply?: string;
		data: any;
	}

	function isReply<T extends object>(reply: T | Reply): reply is Reply {
		return 'data' in reply;
	}

	export async function post(modID: string, msgID: string, data?: any): Promise<any> {
		if (process.platform === 'win32')
			return new Promise((resolve, reject) => {
				const pipe = net.connect('\\\\.\\pipe\\GeodeIPCPipe', () => {
					pipe?.write(JSON.stringify({
						mod: modID,
						message: msgID,
						data,
						reply: 'geode-vscode',
					}));
				})
					.on('error', err => reject(new Error(`Unable to connect to Geode IPC: ${err}`)))
					.on('data', (data) => {
						try {
							const obj = JSON.parse(data.toString());
							resolve(obj.data);
						}
						catch (err) {
							reject(new TypeError(`Received non-JSON IPC message ${err}`));
						}
					});
			});

		return Promise.reject(new Error(`This platform doesn't support IPC yet!`));
	}
}
