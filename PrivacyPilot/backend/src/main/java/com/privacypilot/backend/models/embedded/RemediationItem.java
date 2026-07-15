package com.privacypilot.backend.model.embedded;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.bson.types.ObjectId;

/**
 * One action item on a data-breach case (a step the team must take to fix the
 * problem, e.g. "remote-wipe the lost laptop"). Each item can be ticked off when
 * done, so the breach record shows what has and has not been handled.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RemediationItem {

    // A unique id for this action item.
    private String id = new ObjectId().toHexString();

    // What needs to be done, in plain words.
    private String text;

    // True once this step has been completed.
    private boolean done;
}
