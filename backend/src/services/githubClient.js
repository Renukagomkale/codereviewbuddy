function createGithubClient(tokenFor) {
  let OctokitClass;
  let current;

  async function octokitFor(installationId) {
    const token = await tokenFor(installationId);
    if (!current || current.token !== token) {
      OctokitClass ??= (await import("@octokit/rest")).Octokit;
      current = { token, octokit: new OctokitClass({ auth: token }) };
    }
    return current.octokit;
  }

  return {
    async listPullRequestFiles({ installationId, owner, repo, pullNumber }) {
      const octokit = await octokitFor(installationId);
      return octokit.paginate(octokit.rest.pulls.listFiles, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      });
    },

    async getFileContent({ installationId, owner, repo, path, ref }) {
      const octokit = await octokitFor(installationId);
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
        mediaType: { format: "raw" },
      });
      return typeof data === "string" ? data : "";
    },

    async listReviewComments({ installationId, owner, repo, pullNumber }) {
      const octokit = await octokitFor(installationId);
      return octokit.paginate(octokit.rest.pulls.listReviewComments, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      });
    },

    async createReview({ installationId, owner, repo, pullNumber, commitId, body, comments }) {
      const octokit = await octokitFor(installationId);
      await octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitId,
        event: "COMMENT",
        body,
        comments,
      });
    },
  };
}

module.exports = { createGithubClient };
