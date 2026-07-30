import { useMemo } from "react";
import { useSelector } from "react-redux";
import { CAPABILITIES, getCapabilities } from "../config/capabilities";

// Small helper hook so any component can ask "may this user do X?" in one line:
//
//   const { can, CAPABILITIES } = useCapabilities();
//   {can(CAPABILITIES.OVERTIME_DECIDE) && <button>Approve</button>}
//
// It reads the logged-in user from Redux (the same place the rest of the app reads
// it), so there is nothing to pass in and no chance of one screen judging a
// different user than another.
//
// Remember: hiding a button only keeps the screen tidy. The backend refuses the
// action anyway — see config/capabilities.js for the full explanation.
export function useCapabilities() {
  const user = useSelector((state) => state.auth.user);

  // Work the list out only when the user actually changes. Without this, every
  // re-render would rebuild the same array.
  const capabilities = useMemo(() => getCapabilities(user), [user]);

  const can = (capability) => Boolean(capability) && capabilities.includes(capability);

  return { capabilities, can, CAPABILITIES };
}

export default useCapabilities;
