import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { CAPABILITIES, getCapabilities } from "../config/capabilities";

// Small helper hook so any component can ask "may this user do X?" in one line:
//
//   const { can, CAPABILITIES } = useCapabilities();
//   {can(CAPABILITIES.DOCUMENT_WRITE) && <button>Upload</button>}
//
// It reads the logged-in user from AuthContext, so there is nothing to pass in
// and no chance of one screen using a different user than another.
//
// Remember: hiding a button is only about a tidy screen. The backend refuses the
// action anyway (see config/capabilities.js for the full explanation).
export function useCapabilities() {
  const { user } = useAuth();

  // Work the list out only when the user actually changes. Without this, every
  // re-render would rebuild the same array and any effect depending on it would
  // run again for no reason.
  const capabilities = useMemo(() => getCapabilities(user), [user]);

  const can = (capability) => Boolean(capability) && capabilities.includes(capability);

  return { capabilities, can, CAPABILITIES };
}

export default useCapabilities;
