import { existsSync, mkdirSync, readdirSync } from 'fs';
import * as https from 'https';
import jsonfile from 'jsonfile';
import { Observable } from 'rxjs';

import { Action, IEAMEvent, IEAMPolicy } from './interface/model';
import { HznParams } from './params/hzn-params';

const cp = require('child_process'),
exec = cp.exec;

export class Utils {
  homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
  mmsPath = '/mms-shared';
  localPath = './local-shared';
  assets = './assets';
  sharedPath = '';
  intervalMS = 10000;
  timer: NodeJS.Timer = null;
  timestamp = Date.now();
  logTime = Date.now();

  constructor() {
    this.init()
  }
  init() {
    if(!existsSync(this.localPath)) {
      mkdirSync(this.localPath);
    }
    this.resetTimer()
    console.log(`check per ${this.intervalMS/1000} sec, console.log per 10 minutes, last checked: ${new Date().toLocaleString()}`) 
  }

  httpGet(url) {
    return new Observable((observer) => {
      https.get(url, (resp) => {
        let data = '';
      
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
          data += chunk;
        });      
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
          observer.next(JSON.parse(data));
          observer.complete();
        });     
      }).on("error", (err) => {
        console.log("Error: " + err.message);
        observer.error(err);
      });
    });  
  }
  unregister(params: HznParams) {
    return this.shell(`oh deploy autoUnregister`)
  }
  registerWithPolicy(params: HznParams) {
    return this.shell(`oh deploy autoRegisterWithPolicy`)
  }
  registerWithPattern(params: HznParams) {
    return this.shell(`oh deploy autoRegisterWithPattern`)
  }
  updatePolicy(params: HznParams) {
    return this.shell(`oh deploy autoAddpolicy`)
  }
  checkMMS() : any[] {
    try {
      let list;
      let config;
      if(existsSync(this.mmsPath)) {
        list = readdirSync(this.mmsPath);
        list = list.filter(item => /(\.zip|\.json)$/.test(item));
        this.sharedPath = this.mmsPath;  
      } else if(existsSync(this.localPath)) {
        list = readdirSync(this.localPath);
        config = list.filter(item => item === 'config.json');
        list = list.filter(item => /(\.zip|\.json)$/.test(item));
        this.sharedPath = this.localPath;
      }
      return list;  
    } catch(e) {
      console.log(e)
    }
  }
  resetTimer() {
    clearInterval(this.timer);
    this.timer = null;
    this.setInterval(this.intervalMS);  
  }
  setInterval(ms) {
    this.timer = setInterval(async () => {
      let mmsFiles = this.checkMMS();
      if(Date.now() - this.timestamp > 600000) {
        this.timestamp = Date.now();
        console.log(`last checked: ${new Date().toLocaleString()}`) 
      } else if(Date.now() - this.logTime > 86400000) {
        console.clear();
        this.logTime = Date.now();
      }
      //console.log('checking', mmsFiles)
      if(mmsFiles && mmsFiles.length > 0) {
        mmsFiles.forEach(file => {
          // For now only handle json files
          if(file.indexOf('.json') > 0) {
            let arg = `mv ${this.sharedPath}/${file} ${this.assets}/config.json`
            this.shell(arg)
            .subscribe({
              next: (res) => {
              },
              complete: () => {
                console.log('complete')
                this.doRun();
              },
              error: (err) => {
                console.log('error', err)
                this.resetTimer()
              }
            })
          } else {
            this.doRun();
          }
        });
      } else {
        this.doRun();
      }
    }, ms);
  }
  doRun() {
    clearInterval(this.timer);
    this.runTasks()
    .subscribe({
      complete: () => {
        this.resetTimer()
      },
      error: (err) => {
        this.resetTimer()
      }
    })
  }
  isPropsEqual(prop1, prop2) {
    try {
      let prop3 = {};   
      Object.keys(prop2).forEach((key) => { 
          if(prop2[key] !== null) {
             prop3[key] = prop2[key];
          }
      })
      console.log(JSON.stringify(prop1));
      console.log(JSON.stringify(prop3));
      //console.log(JSON.stringify(prop1) == JSON.stringify(prop3));
      return JSON.stringify(prop1) == JSON.stringify(prop3);
    } catch(e) {
      return false;
    }
  }
  isInArray(prop1, prop2) {
    try {
      let found = false;
      prop1.some((p1) => {
        let ar = prop2.filter((p2) => JSON.stringify(p2) == JSON.stringify(p1))
        found = ar.length > 0
        return found
      })
      return found;
    } catch(e) {
      return false;
    }
  }
  updateConfigJson(cloneEvent: IEAMEvent, eventJson: IEAMEvent[], json: any) {
    return new Observable((observer) => {
      cloneEvent.lastRun = {timestamp: Date.now(), succeeded: true}
      eventJson.push(Object.assign({},cloneEvent))
      json.events = eventJson.slice()
      jsonfile.writeFileSync(`${this.assets}/config.json`, json, {spaces: 2});
      observer.next('')
      observer.complete()
    })
  }
  runTasks() {
    return new Observable((observer) => {
      try {
        let eventJson = [];
        let json = jsonfile.readFileSync(`${this.assets}/config.json`);
        let ieamEvent: IEAMEvent;
        let running = false;
        let arg = '';
        json.events.forEach((event: IEAMEvent, idx) => {
          ieamEvent = new IEAMEvent(event)
          const date = new Date()
          //console.log(ieamEvent.isWithinDateRange(), ieamEvent.isActionAllow(), ieamEvent.isClearToRun(), date.toUTCString())
          //console.log(ieamEvent)
          if(!running && ieamEvent.isClearToRun()) {
            console.log('run tasks')
            running = true
            let cloneEvent = Object.assign({}, ieamEvent)
            switch(Action[cloneEvent.action]) {
              case Action.autoUpdateNodePolicy:
                try {
                  arg = ''
                  let policyStr = cloneEvent.meta && cloneEvent.meta.policy ? JSON.stringify(cloneEvent.meta.policy) : ''
                  if(policyStr.length > 0 && !cloneEvent.lastRun.succeeded) {
                    this.getNodePolicy(false)
                    .subscribe({
                      next: (config: any) => {
                        let equals = [];
                        let policy = cloneEvent.meta.policy;
                        let newPolicy = new IEAMPolicy(policy)
                        Object.keys(policy).forEach((key) => {
                          if(key == 'properties') {
                            equals.push(this.isInArray(newPolicy[key], config[key]))
                          } else {
                            equals.push(this.isPropsEqual(newPolicy[key], config[key]))
                          }  
                        })
                        let res = equals.filter(eq => !eq);
                        if(res.length > 0) {
                          policyStr = policyStr.replace(/\"/g, '\\"')
                          arg = `oh deploy ${cloneEvent.action} --object="${policyStr}"`

                          this.shell(arg)
                          .subscribe({
                            complete: () => {
                              this.updateConfigJson(cloneEvent, eventJson, json)
                              .subscribe(() => {
                                observer.next('')
                                observer.complete()
                              })
                            },
                            error: (err) => {
                              console.log('error', err)
                              observer.error(err)
                            }
                          })          
                        } else {
                          console.log('Update is not needed!')
                          this.updateConfigJson(cloneEvent, eventJson, json)
                          .subscribe(() => {
                            observer.next('')
                            observer.complete()
                          })
                        }
                      },
                      error: (err) => {
                        console.log('error', err)
                        observer.error(err)
                      }
                    })
                  } else {
                    console.log('Update is not needed!')
                    this.updateConfigJson(cloneEvent, eventJson, json)
                    .subscribe(() => {
                      observer.next('')
                      observer.complete()
                    })
                  }
                } catch(e) {
                  observer.error(e)
                }
                break;
              case Action.autoRegisterWithPattern:
              case Action.autoRegisterWithPolicy:
              case Action.autoUnregister: 
                this.getNodeConfig()
                .subscribe({
                  next: (config: any) => {
                    console.log('is configured?', config.configstate, typeof config)
                    arg = `oh deploy ${cloneEvent.action}`
                    if(Action[cloneEvent.action] == Action.autoUnregister) {
                      if(config.configstate.state === 'configured') {
                        arg = '';
                      }
                    } else {
                      if(config.configstate.state !== 'configured') {
                        arg = '';
                      }
                    }
                    if(arg.length > 0) {
                      this.shell(arg)
                      .subscribe({
                        complete: () => {
                          cloneEvent.lastRun = {timestamp: Date.now(), succeeded: true}
                          eventJson.push(Object.assign({},cloneEvent))
                          json.events = eventJson.slice()
                          jsonfile.writeFileSync(`${this.assets}/config.json`, json, {spaces: 2});
                          observer.next('')
                          observer.complete()  
                        },
                        error: (err) => {
                          console.log('error', err)
                          observer.error(err)
                        }
                      })
                    } else {
                      observer.next('')
                      observer.complete()  
                    }
                  },
                  error: (err) => observer.error(err)
                }) 
              break; 
              default:
                running = false;
                break;
            }
          } else {
            eventJson.push(Object.assign({},ieamEvent))
          }
        });
        //console.log(eventJson)
        if(!running) {
          observer.next('')
          observer.complete()  
        }
      } catch(e) {
        console.log(e)
        observer.error(e)
      }
    })
  }
  getNodePolicy(prnStdout=true) {
    return new Observable((observer) => {
      let arg = `hzn policy list`
      this.shell(arg, "Successfully list policy", "Failed to list policy", prnStdout)
      .subscribe({
        next: (res: any) => {
          //console.log(typeof res == 'string')
          try {
            let json = JSON.parse(res)
            observer.next(json)
            observer.complete()
          } catch(e) {
            observer.error(e)
          }
        }, error(e) {
          observer.error(e)
        }
      })
    })  
  }
  getNodeConfig() {
    return new Observable((observer) => {
      let arg = `hzn node list`
      this.shell(arg, "Successfully list node", "Failed to list node")
      .subscribe({
        next: (res: any) => {
          console.log(typeof res == 'string')
          try {
            let json = JSON.parse(res)
            console.log(json.configstate.state)
            observer.next(json)
            observer.complete()
          } catch(e) {
            observer.error(e)
          }
        }, error(e) {
          observer.error(e)
        }
      })
    })  
  }
  shell(arg: string, success='command executed successfully', error='command failed', prnStdout=true, options={maxBuffer: 1024 * 2000}) {
    return new Observable((observer) => {
      console.log(arg);
      if(!prnStdout) {
        options = Object.assign(options, {stdio: 'pipe', encoding: 'utf8'})
      }
      exec(arg, options, (err: any, stdout: any, stderr: any) => {
        if(!err) {
          if(prnStdout) {
            console.log(stdout);
          }
          console.log(success);
          observer.next(stdout);
          observer.complete();
        } else {
          console.log(`${error}: ${err}`);
          observer.error(err);
        }
      })  
    });
  }
  shell2(arg: string, success='command executed successfully', error='command failed', prnStdout=true, options={maxBuffer: 1024 * 2000}) {
    return new Observable((observer) => {
      console.log(arg);
      let child = exec(arg, options, (err: any, stdout: any, stderr: any) => {
        if(!err) {
          // console.log(stdout);
          console.log(success);
          observer.next(prnStdout ? stdout : '');
          observer.complete();
        } else {
          console.log(`${error}: ${err}`);
          observer.error(err);
        }
      });
      child.stdout.pipe(process.stdout);
      child.stdout.on('data', (data) => {
        if(data.indexOf(`Run 'hzn agreement list' to view`) > 0) {
          console.log(success);
          observer.next(prnStdout ? data : '');
          observer.complete();
        }
      })
      child.on('data', (data) => {
        console.log(data)
      })  
    });
  }
}