import ora from 'ora'
import chalk from 'chalk'
import { execa } from 'execa'
import * as fs from 'fs'
import * as path from 'path'

interface DeployOptions {
  target: string
}

export async function deployCommand(options: DeployOptions) {
  console.log()
  console.log(chalk.bold(`  🚀  Deploying to ${options.target}`))
  console.log()

  switch (options.target) {
    case 'vercel': {
      const spinner = ora('Deploying to Vercel...').start()
      try {
        await execa('vercel', ['deploy', '--prod'], { cwd: process.cwd(), stdio: 'inherit' })
        spinner.succeed('Deployed to Vercel')
      } catch {
        spinner.fail('Vercel deployment failed. Make sure the Vercel CLI is installed: npm i -g vercel')
      }
      break
    }

    case 'railway': {
      const railwayConfig = {
        '$schema': 'https://railway.app/railway.schema.json',
        build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' },
        deploy: { startCommand: 'node apps/web/.next/standalone/server.js', healthcheckPath: '/api/health' },
      }
      const configPath = path.join(process.cwd(), 'railway.json')
      fs.writeFileSync(configPath, JSON.stringify(railwayConfig, null, 2))
      console.log(chalk.green('  ✓ Created railway.json'))
      console.log()
      console.log(chalk.dim('  Next: run'), chalk.cyan('railway up'), chalk.dim('to deploy'))
      console.log(chalk.dim('  Docs: https://docs.railway.app'))
      break
    }

    case 'docker': {
      const spinner = ora('Building Docker image...').start()
      try {
        await execa('docker', ['build', '-t', 'helpnest:latest', '.'], {
          cwd: process.cwd(),
          stdio: 'inherit',
        })
        spinner.succeed('Docker image built: helpnest:latest')
        console.log()
        console.log(chalk.dim('  Run with:'))
        console.log(`  ${chalk.cyan('docker run -p 3000:3000 --env-file .env helpnest:latest')}`)
        console.log()
        console.log(chalk.dim('  Or with docker compose:'))
        console.log(`  ${chalk.cyan('docker compose -f docker-compose.prod.yml up -d')}`)
      } catch {
        spinner.fail('Docker build failed')
      }
      break
    }

    default:
      console.log(chalk.red(`  Unknown target: ${options.target}`))
      console.log(chalk.dim('  Valid targets: vercel | railway | docker'))
  }

  console.log()
}
