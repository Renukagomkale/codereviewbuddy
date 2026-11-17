function oid(number) {
  return number.toString(16).padStart(24, "0");
}

function matchesValue(actual, expected) {
  if (expected === null) return actual === null || actual === undefined;
  if (expected instanceof RegExp) return expected.test(String(actual));
  if (expected && typeof expected === "object") {
    if ("$in" in expected) return expected.$in.some((item) => matchesValue(actual, item));
    if ("$gte" in expected) return actual >= expected.$gte;
  }
  return String(actual) === String(expected);
}

function matches(doc, filter) {
  return Object.entries(filter).every(([key, expected]) => matchesValue(doc[key], expected));
}

function createFakeModel(initial = [], { unique = [], aggregateResult = [] } = {}) {
  const docs = [...initial];
  const aggregateCalls = [];
  let counter = 1000;

  function query(list) {
    let result = [...list];
    const chain = {
      sort(spec) {
        const [[key, direction]] = Object.entries(spec);
        result.sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * direction);
        return chain;
      },
      skip(count) {
        result = result.slice(count);
        return chain;
      },
      limit(count) {
        result = result.slice(0, count);
        return chain;
      },
      select() {
        return chain;
      },
      then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return chain;
  }

  return {
    docs,
    aggregateCalls,
    find: (filter = {}) => query(docs.filter((doc) => matches(doc, filter))),
    async findOne(filter) {
      return docs.find((doc) => matches(doc, filter)) || null;
    },
    async findById(id) {
      return docs.find((doc) => String(doc._id) === String(id)) || null;
    },
    async countDocuments(filter = {}) {
      return docs.filter((doc) => matches(doc, filter)).length;
    },
    async create(data) {
      for (const field of unique) {
        if (docs.some((doc) => doc[field] === data[field])) {
          const error = new Error("duplicate key");
          error.code = 11000;
          throw error;
        }
      }
      counter += 1;
      const doc = { _id: oid(counter), ...data };
      docs.push(doc);
      return doc;
    },
    async findOneAndUpdate(filter, update) {
      const doc = docs.find((item) => matches(item, filter));
      if (!doc) return null;
      Object.assign(doc, update);
      return doc;
    },
    async aggregate(pipeline) {
      aggregateCalls.push(pipeline);
      return aggregateResult;
    },
  };
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

async function failureOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return null;
}

module.exports = { oid, createFakeModel, createRes, failureOf };
