function createRuleHandlers({ ruleCatalog }) {
  return {
    async list(req, res) {
      res.json({ rules: await ruleCatalog.getRules() });
    },
  };
}

module.exports = { createRuleHandlers };
