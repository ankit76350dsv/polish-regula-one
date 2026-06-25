package com.ksefflow.backend.repository;

import com.ksefflow.backend.models.KsefAvailabilityState;
import org.springframework.data.mongodb.repository.MongoRepository;

// Stores the single GLOBAL KSeF availability record (see KsefAvailabilityState).
//
// There is only ever one document (id = "GLOBAL"), so we just reuse the standard
// findById / save methods — save() upserts the same id, never creating duplicates.
public interface KsefAvailabilityStateRepository extends MongoRepository<KsefAvailabilityState, String> {
}
