function since(days) {
  const ttl = days * 24 * 60 * 60 * 1000
  let date = new Date(new Date() - ttl)

  // GitHub won't allow it
  if (date < new Date(0)) {
    date = new Date(0)
  }
  return date
}

function issueBodyEmpty(issue) {
  const body = issue.body
  if (body === '' || !body) {
    return true
  } else {
    return body.replace(/(<!--.*?-->)|(<!--[\w\W\n\s]+?-->)/g, '').trim() === ''
  }
}
const REPO = { owner: "monterail", repo: "vuelidate"}
const HOLD_LABEL = 'hold'
const STATUS_WARN = 'warning'
const STATUS_PING = 'ping'

const STATE_CLOSED = 'closed'

const MSG_MORE_INFO = "Thanks for opening this issue! However you did not provide description - it's essential for solving your problem, so please tell us more about it."
const MSG_PING = "No recent activity, is this issue still relevant?"
const MSG_WARN = "No activity for long time, issue will soon be closed"

function addStatus(body, status) {
  return `${body}\n\n<!-- probot = ${status} -->`
}

function getStatus(body = '') {
  const regex = /\n\n<!-- probot = (.*) -->/
  const match = body.match(regex)
  return match ? match[1] : null
}

module.exports = app => {
  const router = app.route('/vuelidate-bot')
  router.get('/wake-up', async (req, res) => {
    res.send('OK')
  })
  router.get('/ping', async (req, res) => {
    const github = await app.auth(process.env.INSTALLATION_ID)

    const timestamp = since(7).toISOString().replace(/\.\d{3}\w$/, '')
    const repoQuery = `{
      repository(owner: "monterail", name: "vuelidate") {
        issues(last: 100, states: [OPEN]) {
          nodes{
            id
            body
            number
            title
            updatedAt
            author {
              login
            }
            labels(first: 10) {
              nodes {
                name
              }
            }
            comments(last: 1) {
              nodes {
                author {
                  login
                }
                body
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    }`

    const gqlResult = await github.query(repoQuery)
    const relevantFilter = issue => !issue.labels.nodes.find(lb => lb.name === HOLD_LABEL) && (new Date(issue.updatedAt) < timestamp)
    const relevantIssues = gqlResult.repository.issues.nodes.filter(relevantFilter)

    relevantIssues.forEach(issue => {
      const body = issue.comments.nodes.length && issue.comments.nodes[0].body || null
      const status = getStatus(body)
      if (status && status === STATUS_WARN) {
        // close issue
        github.issues.update({ ...REPO,
          number: issue.number,
          state: STATE_CLOSED
        })
      } else if (status && status === STATUS_PING) {
        // add WARN
        github.issues.createComment({ ...REPO,
          number: issue.number,
          body: addStatus(MSG_WARN, STATUS_WARN)
        })
      } else {
        // add PING
        github.issues.createComment({...REPO, number: issue.number, body: addStatus(MSG_PING, STATUS_PING)})
      }
    })
    res.send(`Checking ${relevantIssues.length} issues`)
  })

  app.on('issues.opened', async context => {
    if (issueBodyEmpty(context.payload.action.issue)) {
      const issueComment = context.issue({ body: MSG_MORE_INFO })
      return context.github.issues.createComment(issueComment)
    }
  })
}
