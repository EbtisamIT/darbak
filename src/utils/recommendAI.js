export function getRecommendedExperiences(selectedExp, allExperiences) {
    if (!selectedExp) return [];
  
    return allExperiences
      .filter(exp => {
        if (exp.id === selectedExp.id) return false;
        return (
          exp.major === selectedExp.major ||
          exp.description?.includes(selectedExp.major) ||
          selectedExp.description?.includes(exp.major)
        );
      })
      .slice(0, 3); 
  }
  