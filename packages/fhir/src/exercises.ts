import { Types } from "mongoose";


type Options = {
  page?: number;
  limit?: number;
  total?: number;
  type?: string;
  keyword?: string;
}


type Exercise  = {
  _id: Types.ObjectId | string;
  planId?: string;
  planType?: string;
  planName?: string;
  exerciseType?: string;
  exerciseTitle?: string;
  exerciseSubTitle?: string;
  exerciseThumbnail?: string;
  exerciseVideo?: string;
  exerciseDescription?: string;
  toObject?: () => any;
}

type ExerciseType = {
  _id: Types.ObjectId | string;
  exerciseType?: string;
  toObject?: () => any;
}

type Plan = {
  _id: Types.ObjectId | string;
  planType?: string;
  planName?: string;
  toObject?: () => any;
}

export const convertExerciseToFHIR = (exercises: Exercise[], options: Options = {}) => {
    const {
      page = 1,
      limit = 10,
      total = exercises.length,
      type = "",
      keyword = "",
    } = options;

    const entries = exercises.map((exerciseDoc) => {
      const exercise =
        typeof exerciseDoc.toObject === "function"
          ? exerciseDoc.toObject()
          : exerciseDoc;

      return {
        fullUrl: `urn:uuid:${exercise._id}`,
        resource: {
          resourceType: "ActivityDefinition",
          id: exercise._id.toString(),
          status: "active",
          name: exercise.exerciseTitle || "",
          title: exercise.exerciseSubTitle || "",
          description: exercise.exerciseDescription || "",
          kind: "Task",
          code: {
            coding: [
              {
                system: "http://example.org/fhir/exercise-type",
                code: exercise.exerciseType || "",
                display: exercise.exerciseType || "",
              },
            ],
          },
          relatedArtifact: [
            {
              type: "documentation",
              label: "Video",
              url: exercise.exerciseVideo || "",
            },
            {
              type: "documentation",
              label: "Thumbnail",
              url: exercise.exerciseThumbnail || "",
            },
          ],
          extension: [
            {
              url: "http://example.org/fhir/StructureDefinition/planType",
              valueString: exercise.planType || "",
            },
            {
              url: "http://example.org/fhir/StructureDefinition/planName",
              valueString: exercise.planName || "",
            },
            {
              url: "http://example.org/fhir/StructureDefinition/planId",
              valueString: exercise.planId || "",
            },
          ],
        },
      };
    });

    return {
      resourceType: "Bundle",
      type: "searchset",
      total,
      entry: entries,
      link: generatePaginationLinks(page, limit, total, type, keyword),
    };
  }

const generatePaginationLinks = (page: number,limit: number,total: number, type = "",keyword = "") => {
    const last = Math.ceil(total / limit);
    const baseUrl = "/fhir/getExercise";

    const queryParams = [`limit=${limit}`];
    if (type) queryParams.push(`type=${encodeURIComponent(type)}`);
    if (keyword) queryParams.push(`keyword=${encodeURIComponent(keyword)}`);
    const queryStr = queryParams.join("&");

    const links = [
      { relation: "self", url: `${baseUrl}?page=${page}&${queryStr}` },
    ];

    if (page > 1) {
      links.push({
        relation: "previous",
        url: `${baseUrl}?page=${page - 1}&${queryStr}`,
      });
    }

    if (page < last) {
      links.push({
        relation: "next",
        url: `${baseUrl}?page=${page + 1}&${queryStr}`,
      });
    }

    return links;
  }

export const convertPlanTypesToFHIR = (plans: Plan[]) => {
    const entries = plans.map((planDoc) => {
      const plan =
        typeof planDoc.toObject === "function"
          ? planDoc.toObject()
          : planDoc;

      return {
        fullUrl: `urn:uuid:${plan._id}`,
        resource: {
          resourceType: "ActivityDefinition",
          id: plan._id.toString(),
          status: "active",
          name: plan.planType || "",
          description: plan.planName || "",
          kind: "Task",
          extension: [
            {
              url: "http://example.org/fhir/StructureDefinition/planType",
              valueString: plan.planType || "Unknown Plan Type",
            },
            {
              url: "http://example.org/fhir/StructureDefinition/planName",
              valueString: plan.planName || "Unknown Plan Name",
            },
          ],
        },
      };
    });

    return {
      resourceType: "Bundle",
      type: "searchset",
      total: entries.length,
      entry: entries,
    };
  }

  export const convertExerciseTypeToFHIR = (exerciseTypes: ExerciseType[]) => {
    const entries = exerciseTypes.map((typeDoc) => {
      const type =
        typeof typeDoc.toObject === "function"
          ? typeDoc.toObject()
          : typeDoc;

      return {
        fullUrl: `urn:uuid:${type._id}`,
        resource: {
          resourceType: "ActivityDefinition",
          id: type._id.toString(),
          status: "active",
          name: type.exerciseType || "",
          description: type.exerciseType || "",
          kind: "Task",
          extension: [
            {
              url: "http://example.org/fhir/StructureDefinition/exerciseType",
              valueString: type.exerciseType || "",
            },
          ],
        },
      };
    });

    return {
      resourceType: "Bundle",
      type: "searchset",
      total: entries.length,
      entry: entries,
    };
  }