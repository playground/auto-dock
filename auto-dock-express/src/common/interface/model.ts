export interface IPayload {
  hello: string;
  events: IEAMEvent[];
}
export class IEAMEvent {
  title: string = '';
  type: string = '';
  id: string = '';
  action: string = '';
  start: EventTime = { "hour": 7, "minute": 15, "second": 0, "meriden": "PM", "format": 12 };
  end: EventTime = { "hour": 7, "minute": 15, "second": 0, "meriden": "PM", "format": 12 };
  frequency: number = 60000;
  lastRun: number = 0;

  constructor(event: IEAMEvent) {
    Object.assign(this, event)
  }

  getJson() {
    return {}
  }
}

export const AllowableActions = [
  'autoRegisterWithPolicy', 'autoRegisterWithPattern', 'autoUnregister'
]

export class EventTime {
  hour: number;
  minute: number;
  second: number;
  meriden: 'PM' | 'AM';
  format: 12 | 24;
}
