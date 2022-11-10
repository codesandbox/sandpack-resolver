const MAKE_ME_SYNC = "$RemoveMe";

const shouldRemove = (comments) => {
  return (
    comments &&
    comments.find((comment) => {
      return comment.value.trim() === MAKE_ME_SYNC;
    })
  );
};

module.exports = function ({}) {
  return {
    name: "remove",

    visitor: {
      ClassMethod(path) {
        if (shouldRemove(path.node.leadingComments)) {
          // TODO: Figure out how to remove the comment?
          path.remove();
        }
      },
    },
  };
};
