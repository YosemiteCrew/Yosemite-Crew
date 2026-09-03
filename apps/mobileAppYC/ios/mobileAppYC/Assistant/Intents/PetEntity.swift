import AppIntents
import Foundation

/// A pet, as Siri and the Shortcuts app see it.
///
/// Modelling pets as an entity rather than a free-text parameter is what lets
/// Siri disambiguate ("which pet?") and lets a Shortcut hold a stable
/// reference to one animal.
@available(iOS 16.0, *)
struct PetEntity: AppEntity, Identifiable {
  let id: String
  let name: String
  let species: String

  static var typeDisplayRepresentation: TypeDisplayRepresentation {
    TypeDisplayRepresentation(name: "Pet")
  }

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(name)", subtitle: "\(species)")
  }

  static var defaultQuery = PetEntityQuery()
}

/// Answers Siri's lookups from the offline snapshot.
@available(iOS 16.0, *)
struct PetEntityQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [PetEntity] {
    let snapshot = AssistantSnapshotStore.read()
    return snapshot.pets
      .filter { identifiers.contains($0.id) }
      .map { PetEntity(id: $0.id, name: $0.name, species: $0.species) }
  }

  func suggestedEntities() async throws -> [PetEntity] {
    AssistantSnapshotStore.read().pets.map {
      PetEntity(id: $0.id, name: $0.name, species: $0.species)
    }
  }
}
