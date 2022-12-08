import { Server } from './server';

const argv: string = process.argv.slice(2).toString()
const match = argv.match(/--port=/)
const port = match ? parseInt(argv.replace(match[0], '')) : 8888;

export class Index {
  server = new Server(port);
  constructor() {

  }
}

new Index()