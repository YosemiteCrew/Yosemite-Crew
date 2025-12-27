import TaskLibraryDefinitionModel, {
  TaskLibraryDefinitionDocument,
 TaskKind } from "../models/taskLibraryDefinition";

export class TaskLibraryServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "TaskLibraryServiceError";
  }
}

export const TaskLibraryService = {
  async listActive(kind?: TaskKind): Promise<TaskLibraryDefinitionDocument[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (kind) {
      filter.kind = kind;
    }

    return TaskLibraryDefinitionModel.find(filter)
      .sort({ category: 1, name: 1 })
      .exec();
  },

  async getById(id: string): Promise<TaskLibraryDefinitionDocument> {
    const doc = await TaskLibraryDefinitionModel.findById(id).exec();
    if (!doc) {
      throw new TaskLibraryServiceError("Library task not found", 404);
    }
    return doc;
  },
};
