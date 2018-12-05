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

module.exports = app => {
  const router = app.route('/vuelidate-bot')
  router.get('/ping', async (req, res) => {
    const github = await app.auth(process.env.INSTALLATION_ID)

    const timestamp = since(7).toISOString().replace(/\.\d{3}\w$/, '')
    // query = `repo:monterail/vuelidate is:open type:issue -label:hold updated:<${timestamp}`
    const repoQuery = `{
      repository(owner: "monterail", name: "vuelidate") {
        issues(first: 100, states: [OPEN]) {
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
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    }`
    const gqlResult = await github.query(repoQuery)
    app.log({gqlResult})
    res.send(`Checking ${gqlResult.repository.issues.nodes.length} issues`)
  })

  app.on('issues.opened', async context => {
    if (issueBodyEmpty(context.payload.action.issue)) {
      const issueComment = context.issue({ body: "Thanks for opening this issue! However you did not provide description - it's essential for solving your problem, so please tell us more about it." })
      return context.github.issues.createComment(issueComment)
    }
  })
}
