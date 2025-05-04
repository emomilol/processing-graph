import EventBroker from './EventBroker';
import { AnyObject } from '../types/global';
import GraphServerClient from './GraphServerClient';


export default abstract class MessageHandler {
  abstract canHandleMessage( from: GraphServerClient ): boolean;
  abstract handleMessage( message: string, data: AnyObject, server: EventBroker ): void;
}
