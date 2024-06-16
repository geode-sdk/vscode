import { unindent } from '@flowr/utils';
import type { Option } from '../utils/monads';
import { None, Some } from '../utils/monads';
import type { Panel, Widget } from './Widget';

// eslint-disable-next-line ts/no-namespace -- todo
export namespace scripts {
	export type ObserveCallback = (widget: Widget, visible: boolean) => void;
	type ObserverID = number;

	const observers: Observer[] = [];

	export class Observer {
		#id: ObserverID;
		#panel: Panel;

		constructor(panel: Panel, root: Widget, callback: ObserveCallback) {
			this.#panel = panel;
			this.#id = Observer.createID();

			observers.push(this);

			root.on('mount', (_) => {
				panel.post('create-observer', { id: this.#id, root: root.getID() });
				panel.addHandler(
					`visibility-changed-${this.#id}`,
					(_, args) => {
						args.entries.forEach((entry: { id: string; visible: boolean }) => {
							const w = panel.getChild(entry.id, true);
							if (w)
								callback(w, entry.visible);
						});
					},
				);
			}).on('unmount', (_) => {
				panel.post('remove-observer', { id: this.#id });
				panel.removeHandler(`visibility-changed-${this.#id}`);
			});
		}

		private static createID(): ObserverID {
			let id = 0;
			while (id in observers)
				id = Math.random();

			return id;
		}

		remove() {
			this.#panel.post('remove-observer', { id: this.#id });
			if (observers.includes(this))
				observers.splice(observers.indexOf(this), 1);
		}
	}

	export const observer = {
		id: '_scrollToView',
		js: /* javascript */ unindent`
			const intersectionObservers = {};

			onMessage('create-observer', args => {
			const root = getWidget(args.root);
				if (root) {
					const observer = {
						int: null,
						mut: null,
					};
					observer.int = new IntersectionObserver(
							entries => {
								post('visibility-changed-' + args.id, {
								entries: entries.map(entry => {
									return {
										id: getWidgetID(entry.target),
										visible: entry.isIntersecting
									};
								}),
							});
						}, {
							threshold: 0.1
						}
					);

					// detect when children are added to root and 
					// update intersectionobserver accordingly
					observer.mut = new MutationObserver(
						mutations => {
							mutations.forEach(mutation => {
								if (mutation.type === 'childList') {
									mutation.addedNodes.forEach(node => observer.int.observe(node));
									mutation.removedNodes.forEach(node => observer.int.unobserve(node));
								}
							});
						}
					);
					observer.mut.observe(root, {
						childList: true
					});

					[...root.children].forEach(node => {
						observer.int.observe(node);
					});
					intersectionObservers[args.id] = observer;
				} else {
					console.warn("Element '" + args.root + "' not found, unable to create observer!");
				}
			});

			onMessage('remove-observer', args => {
				if (args.id in intersectionObservers) {
					intersectionObservers[args.id].mut.disconnect();
					intersectionObservers[args.id].int.disconnect();
					delete intersectionObservers[args.id];
				}
			});
		`,

		createObserver(panel: Panel, root: Widget, callback: ObserveCallback): Option<Observer> {
			if (panel.isRegisteredWidgetType('_scrollToView')) {
				return Some(new Observer(panel, root, callback));
			}
			else {
				console.warn(
					'createObserver called, but this panel doesn\'t '
					+ 'have the observer script registered',
				);
				return None;
			}
		},
	};

	export const globalClickListener = {
		id: '_globalClickListener',
		js: /* javascript */ unindent`
			const globalClickListeners = [];

			function onGlobalClick(callback) {
				globalClickListeners.push(callback);
			}

			document.addEventListener('click', e => {
				globalClickListeners.forEach(c => c(e));
			});
		`,
	};
}
