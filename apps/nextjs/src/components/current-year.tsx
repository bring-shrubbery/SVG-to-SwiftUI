import React from "react";

export const CurrentYear = () => {
  const currentYear = new Date().getFullYear();

  return React.createElement("span", null, currentYear);
};
