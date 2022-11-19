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
  actionType() {
    return AllowableActions.indexOf(this.action)
  }
}

export const AllowableActions = [
  'autoRegisterWithPolicy', 'autoRegisterWithPattern', 'autoUnregister'
]

export enum Action {
  autoAddNodePolicy = 0,
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
