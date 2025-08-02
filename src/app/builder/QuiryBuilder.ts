import { Query, Aggregate, FilterQuery } from "mongoose";

class QueryBuilder<T> {
  private modelQuery: Query<T[] | T | null, T> | Aggregate<T[]>;
  private query: Record<string, unknown>;
  private queryType: "find" | "aggregate" | "findOne" | "findById";

  constructor(
    modelQuery: Query<T[] | T | null, T> | Aggregate<T[]>,
    query: Record<string, unknown>,
    queryType: "find" | "aggregate" | "findOne" | "findById"
  ) {
    this.query = query;
    this.modelQuery = modelQuery;
    this.queryType = queryType;
  }

  // Search method with explicit type assertion
  search(searchableFields: string[]) {
    const searchCriteria = {
      $or: searchableFields.map((field) => ({
        [field]: { $regex: this.query.searchTerm, $options: "i" },
      })),
    };

    if (this.query.searchTerm && this.queryType === "find") {
      const searchCriteria = {
        $or: searchableFields.map((field) => ({
          [field]: { $regex: this.query.searchTerm, $options: "i" },
        })),
      } as FilterQuery<T>;

      this.modelQuery = (this.modelQuery as Query<T[], T>).find(searchCriteria);
    } else if (this.query.searchTerm && this.queryType === "aggregate") {
      this.modelQuery = (this.modelQuery as Aggregate<T[]>).match(
        searchCriteria
      );
    }
    return this;
  }
  // Filter method
  filter() {
    const queryObj = { ...this.query };
    const excludeFields = [
      "searchTerm",
      "sort",
      "limit",
      "page",
      "fields",
      "projections",
    ];
    excludeFields.forEach((el) => delete queryObj[el]);

    if (this.queryType === "find") {
      this.modelQuery = (this.modelQuery as Query<T[], T>).find(
        queryObj as FilterQuery<T>
      );
    } else if (this.queryType === "aggregate") {
      this.modelQuery = (this.modelQuery as Aggregate<T[]>).match(
        queryObj as FilterQuery<T>
      );
    }
    return this;
  }

  // Sorting method
  sort() {
    const sort = this.query.sort
      ? (this.query.sort as string).split(",").join(" ")
      : "-createdAt";

    if (
      this.queryType === "find" ||
      this.queryType === "findOne" ||
      this.queryType === "findById"
    ) {
      this.modelQuery = (this.modelQuery as Query<T[], T>).sort(sort);
    } else if (this.queryType === "aggregate") {
      this.modelQuery = (this.modelQuery as Aggregate<T[]>).sort(sort);
    }
    return this;
  }

  // Pagination method
  paginate() {
    if (this.queryType === "find" || this.queryType === "aggregate") {
      const page = Number(this.query.page) || 1;
      const limit = Number(this.query.limit) || 10;
      const skip = (page - 1) * limit;
      this.modelQuery = (this.modelQuery as Query<T[], T>)
        .skip(skip)
        .limit(limit);
    }
    return this;
  }

  // Field limiting method
  fields() {
    const fields = this.query.fields
      ? (this.query.fields as string).split(",").join(" ")
      : "-__v";

    if (
      this.queryType === "find" ||
      this.queryType === "findOne" ||
      this.queryType === "findById"
    ) {
      this.modelQuery = (this.modelQuery as Query<T[], T>).select(fields);
    }
    return this;
  }

  // Execute method for queries
  async execute() {
    if (this.modelQuery instanceof Query) {
      return await this.modelQuery.exec();
    } else if (this.modelQuery instanceof Aggregate) {
      return await this.modelQuery.exec();
    }
    return this.modelQuery;
  }

  // For findOne and findById, we handle queries directly
  async get() {
    return await this.execute();
  }
}

export default QueryBuilder;