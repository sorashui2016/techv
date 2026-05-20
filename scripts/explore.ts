import { runExploreSearch } from "../src/lib/explore";

runExploreSearch()
  .then((result) => {
    console.log(
      `Explore search completed. rules=${result.searchedRuleCount} candidates=${result.candidateCount} new=${result.newCandidateCount}`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
