import { eventBus } from './eventBus.js';
import type { AlfredState } from '../types/events.js';
class StateMachine { private state:AlfredState='idle'; get(){return this.state} set(next:AlfredState,reason?:string){this.state=next;eventBus.emit('voice.state.changed',{state:next,reason})} }
export const stateMachine=new StateMachine();
