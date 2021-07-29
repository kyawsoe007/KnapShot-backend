module.exports = function (page, pageSize) {

    const offset = page * pageSize;

    const limit = offset + pageSize;

    return { offset, limit };
}