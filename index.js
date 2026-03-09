const { spawn } = require('child_process')
const path = require('path')

console.log('Starting . . .')

function waBot() {
   let args = [path.join(__dirname, 'app.js'), ...process.argv.slice(2)]
   console.log([process.argv[0], ...args].join('\n'))
   let p = spawn(process.argv[0], args, {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
   })

   p.on('message', data => {
      if (data === 'reset') {
         console.log('Restarting waBot...')
         p.kill()
         waBot()
      }
   })

   p.on('exit', code => {
      console.error('waBot exited with code:', code)
      if (code === 1 || code === 0) waBot()
   })
}

waBot()
