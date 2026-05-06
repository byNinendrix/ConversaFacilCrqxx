import React from "react";

const ColorModeContext = React.createContext({
  toggleColorMode: () => {},
  setColorMode: () => {},
  clearColorModeOverride: () => {}
});

export default ColorModeContext;
