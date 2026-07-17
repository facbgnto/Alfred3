import type { AlfredEvent } from '../types/events.js';
type Listener=(event:AlfredEvent)=>void;
class EventBus { private listeners=new Set<Listener>();
 emit(type:string,payload?:unknown){const event={type,timestamp:new Date().toISOString(),payload};for(const l of this.listeners)l(event)}
 subscribe(listener:Listener){this.listeners.add(listener);return()=>this.listeners.delete(listener)} }
export const eventBus=new EventBus();
