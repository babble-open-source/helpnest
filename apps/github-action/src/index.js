import * as core from '@actions/core';
import * as github from '@actions/github';
import crypto from 'crypto';
async function run() {
    try {
        const context = github.context;
        const { pull_request } = context.payload;
        // Only run on merged PRs
        if (!pull_request?.merged) {
            core.info('Not a merged PR — skipping HelpNest draft.');
            return;
        }
        // Check skip labels
        const skipLabels = core.getInput('skip-labels')
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean);
        const prLabels = pull_request.labels ?? [];
        if (prLabels.some((l) => skipLabels.includes(l.name))) {
            core.info('PR has a skip label — skipping HelpNest draft.');
            return;
        }
        const apiKey = core.getInput('api-key', { required: true });
        const workspace = core.getInput('workspace', { required: true });
        const baseUrl = core.getInput('base-url').replace(/\/$/, '');
        const collection = core.getInput('collection') || undefined;
        const featureId = core.getInput('feature-id') || undefined;
        const sendDiff = core.getInput('send-diff') === 'true';
        const diffMaxLines = parseInt(core.getInput('diff-max-lines'), 10) || 150;
        const repo = context.repo;
        // Build codeContext
        const codeContext = {
            prTitle: String(pull_request.title).slice(0, 200),
            prBody: pull_request.body ? String(pull_request.body).slice(0, 2000) : undefined,
            repository: `${repo.owner}/${repo.repo}`,
            prUrl: pull_request.html_url,
        };
        if (sendDiff) {
            const token = core.getInput('github-token', { required: true });
            const octokit = github.getOctokit(token);
            try {
                const files = await octokit.rest.pulls.listFiles({
                    owner: repo.owner,
                    repo: repo.repo,
                    pull_number: pull_request.number,
                });
                const changedFiles = files.data.map((f) => f.filename);
                codeContext.changedFiles = changedFiles;
                const diffLines = [];
                for (const f of files.data) {
                    if (f.patch) {
                        for (const line of f.patch.split('\n')) {
                            if (diffLines.length >= diffMaxLines)
                                break;
                            diffLines.push(line);
                        }
                    }
                    if (diffLines.length >= diffMaxLines)
                        break;
                }
                if (diffLines.length > 0) {
                    codeContext.diff = diffLines.join('\n');
                }
            }
            catch (err) {
                core.warning(`Could not fetch PR diff: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        // Idempotency key based on PR URL + workspace to prevent duplicate drafts on re-runs
        const idempotencyKey = crypto
            .createHash('sha256')
            .update(`${pull_request.html_url}:${workspace}`)
            .digest('hex')
            .slice(0, 32);
        const endpoint = featureId ? 'push-feature-context' : 'generate-article';
        const url = `${baseUrl}/api/ai/${endpoint}`;
        const requestBody = featureId
            ? { featureId, collectionId: collection, codeContext }
            : { collectionId: collection, codeContext, idempotencyKey };
        // Call with retry + exponential backoff
        let lastError = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 30_000);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (res.ok) {
                    const data = (await res.json());
                    if (featureId) {
                        core.info(`Queued for feature ${data.featureId ?? featureId} (contexts collected)`);
                    }
                    else {
                        core.info(`Draft ${data.mode}: "${data.title}" — article ID: ${data.articleId}`);
                    }
                    return;
                }
                const errorText = await res.text().catch(() => `HTTP ${res.status}`);
                lastError = new Error(`HelpNest API returned ${res.status}: ${errorText}`);
                if (res.status < 500)
                    break; // client error, no point retrying
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
            }
            if (attempt < 3) {
                const delay = attempt * 5000;
                core.info(`Attempt ${attempt} failed, retrying in ${delay / 1000}s...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        // Never fail CI — only warn
        core.warning(`HelpNest draft action failed (non-blocking): ${lastError?.message ?? 'Unknown error'}`);
    }
    catch (err) {
        // Top-level catch — still never fail CI
        core.warning(`HelpNest draft action error (non-blocking): ${err instanceof Error ? err.message : String(err)}`);
    }
}
run();
