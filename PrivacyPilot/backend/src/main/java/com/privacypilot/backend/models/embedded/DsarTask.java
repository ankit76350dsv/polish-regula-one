package com.privacypilot.backend.model.embedded;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.bson.types.ObjectId;

/**
 * One to-do item for handling a data-subject request (for example "export the
 * personnel file" or "remove from the mailing list"). Ticking these off shows
 * the request is being worked through before its deadline.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DsarTask {

    // A unique id for this task.
    private String id = new ObjectId().toHexString();

    // What needs to be done, in plain words.
    private String text;

    // True once this task has been completed.
    private boolean done;
}
