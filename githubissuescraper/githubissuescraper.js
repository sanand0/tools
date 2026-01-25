(function (root) {
  root.githubissuescraper = {
    scrape: function () {
      const match = window.location.href.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);

      if (!match) {
        alert('❌ Not a GitHub issue page');
        return;
      }

      const [, owner, repo, issueNumber] = match;
      const token = prompt('GitHub Token (optional - press OK to skip):\n\nWithout token: 60 requests/hour\nWith token: 5000 requests/hour\n\nGet token: https://github.com/settings/tokens');

      const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Issue-Converter'
      };

      if (token && token.trim()) {
        headers['Authorization'] = `token ${token.trim()}`;
      }

      async function fetchData() {
        try {
          const issueRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, { headers });
          if (!issueRes.ok) throw new Error(`API Error: ${issueRes.status}`);
          const issue = await issueRes.json();

          const commentsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { headers });
          const comments = commentsRes.ok ? await commentsRes.json() : [];

          const timelineRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/timeline`, {
            headers: { ...headers, 'Accept': 'application/vnd.github.mockingbird-preview+json' }
          });
          const timeline = timelineRes.ok ? await timelineRes.json() : [];

          const md = [];

          md.push(`# ${issue.title} #${issue.number}\n`);
          md.push(`**Repository:** ${owner}/${repo}`);
          md.push(`**Status:** ${issue.state}`);
          md.push(`**Author:** @${issue.user.login}`);
          md.push(`**Created:** ${new Date(issue.created_at).toLocaleString()}`);
          md.push(`**Updated:** ${new Date(issue.updated_at).toLocaleString()}`);

          if (issue.closed_at) {
            md.push(`**Closed:** ${new Date(issue.closed_at).toLocaleString()}`);
          }

          if (issue.labels?.length) {
            md.push(`**Labels:** ${issue.labels.map(l => `\`${l.name}\``).join(', ')}`);
          }

          if (issue.assignees?.length) {
            md.push(`**Assignees:** ${issue.assignees.map(a => `@${a.login}`).join(', ')}`);
          }

          if (issue.milestone) {
            md.push(`**Milestone:** ${issue.milestone.title}`);
          }

          md.push(`**URL:** ${issue.html_url}`);
          md.push('\n---\n');
          md.push('## Description\n');
          md.push(issue.body || '*No description provided*');
          md.push('\n---\n');

          const events = [
            ...comments.map(c => ({ type: 'comment', data: c, created_at: c.created_at })),
            ...timeline.map(t => ({ type: 'event', data: t, created_at: t.created_at }))
          ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

          if (events.length) {
            md.push('## Activity\n');

            events.forEach(evt => {
              if (evt.type === 'comment') {
                const c = evt.data;
                md.push(`### 💬 Comment by @${c.user.login}`);
                md.push(`*${new Date(c.created_at).toLocaleString()}*\n`);
                md.push(c.body);
                md.push('');
              } else {
                const e = evt.data;
                const actor = e.actor ? `@${e.actor.login}` : 'Someone';
                const time = new Date(e.created_at).toLocaleString();

                switch (e.event) {
                  case 'closed':
                    md.push(`**🔒 ${actor}** closed this issue on *${time}*\n`);
                    break;
                  case 'reopened':
                    md.push(`**🔓 ${actor}** reopened this issue on *${time}*\n`);
                    break;
                  case 'labeled':
                    md.push(`**🏷️ ${actor}** added label \`${e.label.name}\` on *${time}*\n`);
                    break;
                  case 'unlabeled':
                    md.push(`**🏷️ ${actor}** removed label \`${e.label.name}\` on *${time}*\n`);
                    break;
                  case 'assigned':
                    md.push(`**👤 ${actor}** assigned @${e.assignee.login} on *${time}*\n`);
                    break;
                  case 'unassigned':
                    md.push(`**👤 ${actor}** unassigned @${e.assignee.login} on *${time}*\n`);
                    break;
                  case 'renamed':
                    md.push(`**✏️ ${actor}** renamed from "${e.rename.from}" to "${e.rename.to}" on *${time}*\n`);
                    break;
                  case 'locked':
                    md.push(`**🔐 ${actor}** locked this issue on *${time}*\n`);
                    break;
                  case 'unlocked':
                    md.push(`**🔓 ${actor}** unlocked this issue on *${time}*\n`);
                    break;
                  case 'milestoned':
                    md.push(`**🎯 ${actor}** added this to milestone ${e.milestone.title} on *${time}*\n`);
                    break;
                  case 'demilestoned':
                    md.push(`**🎯 ${actor}** removed this from milestone ${e.milestone.title} on *${time}*\n`);
                    break;
                  default:
                    md.push(`**⚡ ${actor}** ${e.event} on *${time}*\n`);
                }
              }
            });
          }

          const markdown = md.join('\n');

          await navigator.clipboard.writeText(markdown);
          alert('✅ Issue copied to clipboard!');

        } catch (err) {
          alert('❌ Error: ' + err.message);
          console.error(err);
        }
      }

      fetchData();
    }
  };
})(window);
