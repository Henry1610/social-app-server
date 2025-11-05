import prisma from "./prisma.js";

export const getReactionCounts = async (ids, targetType) => {
  if (!ids || ids.length === 0) return {};
  
  const reactions = await prisma.reaction.groupBy({
    by: ['targetId'],
    where: {
      targetId: { in: ids },
      targetType: targetType
    },
    _count: true
  });

  const countMap = {};
  reactions.forEach(r => {
    countMap[r.targetId] = r._count;
  });

  return countMap;
};


