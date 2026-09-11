import React from "react";
import ResumeSetupJourney from "./ResumeSetupJourney";

const ResumeFactsReviewJourney = ({ resume, onChange, onAutosave, onBack, onRebuild, rebuilding = false, storageScope = "" }) => (
  <ResumeSetupJourney
    resume={resume}
    onChange={onChange}
    onAutosave={onAutosave}
    onBuild={onRebuild}
    building={rebuilding}
    mode="review"
    storageScope={storageScope}
    onExit={onBack}
  />
);

export default ResumeFactsReviewJourney;
