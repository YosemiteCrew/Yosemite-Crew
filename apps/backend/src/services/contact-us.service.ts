import { RootFilterQuery } from "mongoose";
import ContactRequestModel, {
  ContactAttachment,
  ContactRequestMongo,
  ContactSource,
  ContactStatus,
  ContactType,
  DsraDetails,
} from "../models/contect-us";

export type DashboardStatsFilter = {
  from?: Date;
  to?: Date;
  organisationId?: string;
};

export type CountByStatus = Record<ContactStatus, number>;

export type TypeStats = {
  count: number;
  byStatus: CountByStatus;
};

export type DashboardStatsResponse = {
  total: TypeStats;
  byType: Record<ContactType, TypeStats>;
  bySource: Record<ContactSource, number>;
};

export class ContactServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "ContactServiceError";
  }
}

export type CreateContactRequestInput = {
  type: ContactType;
  source: ContactSource;
  subject: string;
  message: string;
  userId?: string;
  email?: string;
  organisationId?: string;
  companionId?: string;
  parentId?: string;
  dsarDetails?: DsraDetails;
  attachments?: ContactAttachment[];
};

export type ListContactRequestFilter = {
  status?: ContactStatus;
  type?: ContactType;
  organisationId?: string;
};

export const ContactService = {
  async createRequest(input: CreateContactRequestInput) {
    // Basic validations
    if (!input.subject || !input.message) {
      throw new ContactServiceError("subject and message are required", 400);
    }

    if (input.type === "DSAR") {
      if (!input.dsarDetails?.requesterType) {
        throw new ContactServiceError(
          "DSAR requests must include dsarDetails.requesterType",
          400,
        );
      }
      if (!input.dsarDetails.declarationAccepted) {
        throw new ContactServiceError("DSAR declaration must be accepted", 400);
      }
      input.dsarDetails.declarationAcceptedAt =
        input.dsarDetails.declarationAcceptedAt ?? new Date();
    }

    const doc = await ContactRequestModel.create({
      ...input,
      status: "OPEN",
    });
    return doc;
  },

  async listRequests(filter: ListContactRequestFilter) {
    const query: RootFilterQuery<ContactRequestMongo> = {};
    if (filter.status) query.status = filter.status;
    if (filter.type) query.type = filter.type;
    if (filter.organisationId) query.organisationId = filter.organisationId;

    return ContactRequestModel.find(query).sort({ createdAt: -1 }).limit(100);
  },

  async getById(id: string) {
    return ContactRequestModel.findById(id);
  },

  async updateStatus(id: string, status: ContactStatus) {
    return ContactRequestModel.findByIdAndUpdate(id, { status }, { new: true });
  },

  async getDashboardStats(
    filter: DashboardStatsFilter = {},
  ): Promise<DashboardStatsResponse> {
    const match: RootFilterQuery<ContactRequestMongo> = {};
    if (filter.from || filter.to) {
      const dateRange: { $gte?: Date; $lte?: Date } = {};
      if (filter.from) dateRange.$gte = filter.from;
      if (filter.to) dateRange.$lte = filter.to;
      match.createdAt = dateRange;
    }
    if (filter.organisationId) {
      match.organisationId = filter.organisationId;
    }

    const emptyCountByStatus = (): CountByStatus =>
      (["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as ContactStatus[]).reduce(
        (acc, s) => ({ ...acc, [s]: 0 }),
        {} as CountByStatus,
      );

    const types: ContactType[] = [
      "GENERAL_ENQUIRY",
      "FEATURE_REQUEST",
      "DSAR",
      "COMPLAINT",
    ];
    const sources: ContactSource[] = [
      "MOBILE_APP",
      "PMS_WEB",
      "MARKETING_SITE",
    ];

    const byType = types.reduce(
      (acc, t) => ({
        ...acc,
        [t]: { count: 0, byStatus: emptyCountByStatus() },
      }),
      {} as Record<ContactType, TypeStats>,
    );
    const bySource = sources.reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {} as Record<ContactSource, number>,
    );

    type FacetResult = {
      byTypeStatus: Array<{
        _id: { type?: ContactType; status?: ContactStatus };
        count: number;
      }>;
      bySource: Array<{ _id?: ContactSource; count: number }>;
    };

    const agg = await ContactRequestModel.aggregate<FacetResult>([
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      {
        $facet: {
          byTypeStatus: [
            {
              $group: {
                _id: { type: "$type", status: "$status" },
                count: { $sum: 1 },
              },
            },
          ],
          bySource: [{ $group: { _id: "$source", count: { $sum: 1 } } }],
        },
      },
    ]);

    const result = agg[0];
    if (result?.byTypeStatus) {
      for (const row of result.byTypeStatus) {
        const type = row._id.type;
        const status = row._id.status;
        if (type && status && type in byType) {
          byType[type].count += row.count;
          byType[type].byStatus[status] = row.count;
        }
      }
    }
    if (result?.bySource) {
      for (const row of result.bySource) {
        const src = row._id;
        if (src && src in bySource) {
          bySource[src] = row.count;
        }
      }
    }

    const total: TypeStats = {
      count: Object.values(byType).reduce((sum, t) => sum + t.count, 0),
      byStatus: types.reduce((acc, t) => {
        for (const s of Object.keys(acc) as ContactStatus[]) {
          acc[s] += byType[t].byStatus[s] ?? 0;
        }
        return acc;
      }, emptyCountByStatus()),
    };

    return { total, byType, bySource };
  },
};
