export interface IPayload {
  hello: string;
  events: IEAMEvent[];
}
export class IEAMEvent {
  title: string = '';
  type: string = '';
  id: string = '';
  action: string = '';
  meta: any = {};
  start: string = '';
  end: string = '';
  frequency: number = 60000;
  lastRun: number = 0;

  constructor(event: IEAMEvent) {
    Object.assign(this, event)
  }

  isValidDate(date: string) {
    return !isNaN(Date.parse(date))
  }
  getStartTime() {
    return new Date(this.start)
  }
  getEndTime() {
    return new Date(this.end)
  }
  isWithinDateRange() {
    if(this.isValidDate(this.start) && this.isValidDate(this.end)) {
      const date = new Date()
      const start = new Date(this.start)
      const end = new Date(this.end)
      return date >= start && date <= end
    } else {
      return false
    }
  }
  isWithinTimeRange() {
    if(this.isWithinDateRange()) {
      const date = new Date()
      const start = new Date(this.start)
      const end = new Date(this.end)
      const time = date.getHours()*3600 + date.getMinutes()*60 + date.getSeconds()
      const stime = start.getHours()*3600 + start.getMinutes()*60 + start.getSeconds() 
      const etime = end.getHours()*3600 + end.getMinutes()*60 + end.getSeconds() 
      return time >= stime && time <= etime
    } else {
      return false
    }
  }
  isTimeToRun() {
    if(this.isWithinDateRange()) {
      return Date.now() - this.lastRun > this.frequency
    } else {
      return false
    }
  }
  isActionAllow() {
    return AllowableActions.indexOf(this.action) >= 0
  }
  isClearToRun() {
    return this.isActionAllow() && this.isWithinTimeRange() && this.isTimeToRun()
  }
}

export class EnumClass {
  private enum: any = {};
  constructor(private eArray: any[] = []) {
    eArray.map((el, idx) => {
      this.enum[el] = idx;
    });
  }

  getEnum(key: string) {
    return this.enum[key];
  }
}

export const AllowableActions = [
  'autoRegisterWithPolicy', 'autoRegisterWithPattern', 'autoUnregister', 'autoUpdateNodePolicy'
]

export enum Action {
  autoUpdateNodePolicy = 0,
  autoRegisterWithPolicy = 1,
  autoRegisterWithPattern = 2,
  autoUnregister = 3
}

export class EventTime {
  hour: number;
  minute: number;
  second: number;
  meriden: 'PM' | 'AM';
  format: 12 | 24;
}

export interface IProperty {
  name: string;
  value: string;
}
export interface IConstraint {
  constraints: string[] | null;
}
export class PolicyClass {
  properties: IProperty[] | null = null;
  constraints: IConstraint = null;
}
export class IEAMPolicy {
  properties: IProperty[];
  constraints: IConstraint;
  deployment: PolicyClass = new PolicyClass();
  managment: PolicyClass = new PolicyClass();

  constructor(policy: IEAMPolicy) {
    Object.assign(this, policy)
  }
}

export const TopLevelDefaultProperties = [
  'openhorizon.hardwareId', 'openhorizon.operatingSystem', 'openhorizon.containerized', 'openhorizon.cpu', 'openhorizon.arch', 'openhorizon.memory'
]