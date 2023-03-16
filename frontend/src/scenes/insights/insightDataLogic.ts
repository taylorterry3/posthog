import { actions, connect, kea, key, listeners, path, props, reducers, selectors } from 'kea'
import { FilterType, InsightLogicProps } from '~/types'
import { keyForInsightLogicProps } from 'scenes/insights/sharedUtils'
import {
    BreakdownFilter,
    DataNode,
    DateRange,
    InsightFilter,
    InsightNodeKind,
    InsightQueryNode,
    InsightVizNode,
    Node,
    NodeKind,
} from '~/queries/schema'

import type { insightDataLogicType } from './insightDataLogicType'
import { insightLogic } from './insightLogic'
import { queryNodeToFilter } from '~/queries/nodes/InsightQuery/utils/queryNodeToFilter'
import { filtersToQueryNode } from '~/queries/nodes/InsightQuery/utils/filtersToQueryNode'
import {
    filterForQuery,
    filterPropertyForQuery,
    isFunnelsQuery,
    isInsightVizNode,
    isLifecycleQuery,
    isPathsQuery,
    isRetentionQuery,
    isStickinessQuery,
    isTrendsQuery,
} from '~/queries/utils'
import { featureFlagLogic } from 'lib/logic/featureFlagLogic'
import { FEATURE_FLAGS, NON_TIME_SERIES_DISPLAY_TYPES } from 'lib/constants'
import { cleanFilters } from './utils/cleanFilters'
import { getBreakdown, getCompare, getDisplay, getInterval, getSeries } from '~/queries/nodes/InsightViz/utils'
import { nodeKindToDefaultQuery } from '~/queries/nodes/InsightQuery/defaults'
import { dataNodeLogic } from '~/queries/nodes/DataNode/dataNodeLogic'
import { insightVizDataNodeKey } from '~/queries/nodes/InsightViz/InsightViz'
import { subscriptions } from 'kea-subscriptions'
import { queryExportContext } from '~/queries/query'
import { dataManagerLogic, QueryId } from '~/queries/nodes/DataNode/dataManagerLogic'
import { uuid } from 'lib/utils'
import { objectsEqual } from 'lib/utils'
import { displayTypesWithoutLegend } from 'lib/components/InsightLegend/utils'

const defaultQuery = (insightProps: InsightLogicProps): Node => {
    const filters = insightProps.cachedInsight?.filters
    const query = insightProps.cachedInsight?.query
    return query ? query : filters ? queryFromFilters(filters) : queryFromKind(NodeKind.TrendsQuery)
}

const queryFromFilters = (filters: Partial<FilterType>): InsightVizNode => ({
    kind: NodeKind.InsightVizNode,
    source: filtersToQueryNode(filters),
})

export const queryFromKind = (kind: InsightNodeKind): InsightVizNode => ({
    kind: NodeKind.InsightVizNode,
    source: nodeKindToDefaultQuery[kind],
})

export const insightDataLogic = kea<insightDataLogicType>([
    props({} as InsightLogicProps),
    key(keyForInsightLogicProps('new')),
    path((key) => ['scenes', 'insights', 'insightDataLogic', key]),

    connect((props: InsightLogicProps) => ({
        values: [
            insightLogic,
            ['insight', 'isUsingDataExploration'],
            featureFlagLogic,
            ['featureFlags'],
            trendsLogic,
            ['toggledLifecycles as trendsLifecycles'],
            dataManagerLogic,
            ['getQueryLoading', 'getQueryResponse', 'getQueryError'],
        ],
        actions: [
            insightLogic,
            [
                'setFilters',
                'setInsight',
                'loadInsightSuccess',
                'loadResultsSuccess',
                'saveInsight as insightLogicSaveInsight',
            ],
            trendsLogic(props),
            ['setLifecycles as setTrendsLifecycles'],
            dataManagerLogic,
            ['runQuery'],
        ],
    })),

    actions({
        setQuery: (query: Node) => ({ query }),
        updateQuerySource: (query: Omit<Partial<InsightQueryNode>, 'kind'>) => ({ query }),
        updateInsightFilter: (insightFilter: InsightFilter) => ({ insightFilter }),
        updateDateRange: (dateRange: DateRange) => ({ dateRange }),
        updateBreakdown: (breakdown: BreakdownFilter) => ({ breakdown }),
        saveInsight: (redirectToViewMode = true) => ({ redirectToViewMode }),
        getInsightData: (queryId: QueryId) => ({ queryId }),
    }),

    reducers(({ props }) => ({
        query: [
            defaultQuery(props),
            {
                setQuery: (_, { query }) => query,
            },
        ],
        queryId: [
            null as QueryId | null,
            {
                getInsightData: (_, { queryId }) => queryId,
            },
        ],
    })),

    selectors({
        isTrends: [(s) => [s.querySource], (q) => isTrendsQuery(q)],
        isFunnels: [(s) => [s.querySource], (q) => isFunnelsQuery(q)],
        isRetention: [(s) => [s.querySource], (q) => isRetentionQuery(q)],
        isPaths: [(s) => [s.querySource], (q) => isPathsQuery(q)],
        isStickiness: [(s) => [s.querySource], (q) => isStickinessQuery(q)],
        isLifecycle: [(s) => [s.querySource], (q) => isLifecycleQuery(q)],
        isTrendsLike: [(s) => [s.querySource], (q) => isTrendsQuery(q) || isLifecycleQuery(q) || isStickinessQuery(q)],
        supportsDisplay: [(s) => [s.querySource], (q) => isTrendsQuery(q) || isStickinessQuery(q)],
        supportsCompare: [(s) => [s.querySource], (q) => isTrendsQuery(q) || isStickinessQuery(q)],

        querySource: [(s) => [s.query], (query) => (query as InsightVizNode).source],

        dateRange: [(s) => [s.querySource], (q) => q.dateRange],
        breakdown: [(s) => [s.querySource], (q) => getBreakdown(q)],
        display: [(s) => [s.querySource], (q) => getDisplay(q)],
        compare: [(s) => [s.querySource], (q) => getCompare(q)],
        series: [(s) => [s.querySource], (q) => getSeries(q)],
        interval: [(s) => [s.querySource], (q) => getInterval(q)],

        insightFilter: [(s) => [s.querySource], (q) => filterForQuery(q)],
        trendsFilter: [(s) => [s.querySource], (q) => (isTrendsQuery(q) ? q.trendsFilter : null)],
        funnelsFilter: [(s) => [s.querySource], (q) => (isFunnelsQuery(q) ? q.funnelsFilter : null)],
        retentionFilter: [(s) => [s.querySource], (q) => (isRetentionQuery(q) ? q.retentionFilter : null)],
        pathsFilter: [(s) => [s.querySource], (q) => (isPathsQuery(q) ? q.pathsFilter : null)],
        stickinessFilter: [(s) => [s.querySource], (q) => (isStickinessQuery(q) ? q.stickinessFilter : null)],
        lifecycleFilter: [(s) => [s.querySource], (q) => (isLifecycleQuery(q) ? q.lifecycleFilter : null)],

        isNonTimeSeriesDisplay: [
            (s) => [s.display],
            (display) => !!display && NON_TIME_SERIES_DISPLAY_TYPES.includes(display),
        ],

        hasLegend: [
            (s) => [s.isTrends, s.isStickiness, s.display],
            (isTrends, isStickiness, display) =>
                (isTrends || isStickiness) && !!display && !displayTypesWithoutLegend.includes(display),
        ],

        isQueryBasedInsight: [
            (s) => [s.query],
            (query) => {
                return !!query && !isInsightVizNode(query)
            },
        ],

        exportContext: [
            (s) => [s.query, s.insight],
            (query, insight) => {
                const filename = ['export', insight.name || insight.derived_name].join('-')
                return { ...queryExportContext(query), filename }
            },
        ],

        response: [
            (s) => [s.queryId, s.getQueryResponse],
            (queryId, getQueryResponse) => {
                return getQueryResponse(queryId)
            },
            { equalityCheck: () => false, resultEqualityCheck: () => false },
        ],
        insightData: [
            (s) => [s.queryId, s.getQueryResponse],
            (queryId, getQueryResponse) => {
                return getQueryResponse(queryId)
            },
            { equalityCheck: () => false, resultEqualityCheck: () => false },
        ],

        queryChanged: [
            (s) => [s.query, s.insight],
            (query, insight) => {
                return !objectsEqual(query, insight.query)
            },
        ],
    }),

    listeners(({ actions, values }) => ({
        updateDateRange: ({ dateRange }) => {
            const newQuerySource = { ...values.querySource, dateRange }
            actions.updateQuerySource(newQuerySource)
        },
        updateBreakdown: ({ breakdown }) => {
            const newQuerySource = { ...values.querySource, breakdown }
            actions.updateQuerySource(newQuerySource)
        },
        updateInsightFilter: ({ insightFilter }) => {
            const filterProperty = filterPropertyForQuery(values.querySource)
            const newQuerySource = { ...values.querySource }
            newQuerySource[filterProperty] = {
                ...values.querySource[filterProperty],
                ...insightFilter,
            }
            actions.updateQuerySource(newQuerySource)
        },
        updateQuerySource: ({ query }) => {
            actions.setQuery({
                ...values.query,
                source: { ...(values.query as InsightVizNode).source, ...query },
            } as Node)
        },
        setQuery: ({ query }) => {
            // safeguard against accidentally overwriting filters for non-flagged users
            if (!values.featureFlags[FEATURE_FLAGS.DATA_EXPLORATION_INSIGHTS]) {
                return
            }

            if (isInsightVizNode(query)) {
                const querySource = (query as InsightVizNode).source

                actions.getInsightData(uuid())

                if (isLifecycleQuery(querySource)) {
                    const filters = queryNodeToFilter(querySource)
                    actions.setFilters(filters)

                    if (querySource.lifecycleFilter?.toggledLifecycles !== values.trendsLifecycles) {
                        actions.setTrendsLifecycles(
                            querySource.lifecycleFilter?.toggledLifecycles
                                ? querySource.lifecycleFilter.toggledLifecycles
                                : ['new', 'resurrecting', 'returning', 'dormant']
                        )
                    }
                }
            }
        },
        setInsight: ({ insight: { filters, query }, options: { overrideFilter } }) => {
            if (overrideFilter && query == null) {
                actions.setQuery(queryFromFilters(cleanFilters(filters || {})))
            } else if (query) {
                actions.setQuery(query)
            }
        },
        loadInsightSuccess: ({ insight }) => {
            if (!!insight.query) {
                actions.setQuery(insight.query)
            } else if (!!insight.filters && !!Object.keys(insight.filters).length) {
                const query = queryFromFilters(insight.filters)
                actions.setQuery(query)
            }
        },
        loadResultsSuccess: ({ insight }) => {
            if (!!insight.query) {
                actions.setQuery(insight.query)
            } else if (!!insight.filters && !!Object.keys(insight.filters).length) {
                const query = queryFromFilters(insight.filters)
                actions.setQuery(query)
            }
        },
        saveInsight: ({ redirectToViewMode }) => {
            let filters = values.insight.filters
            if (isInsightVizNode(values.query)) {
                const querySource = values.query.source
                filters = queryNodeToFilter(querySource)
            } else if (values.isQueryBasedInsight) {
                filters = {}
            }

            actions.setInsight(
                {
                    ...values.insight,
                    filters: filters,
                    ...(values.isQueryBasedInsight ? { query: values.query } : {}),
                },
                { overrideFilter: true, fromPersistentApi: false }
            )
            actions.insightLogicSaveInsight(redirectToViewMode)
        },
        getInsightData: ({ queryId }) => {
            actions.runQuery(queryId, values.querySource)
        },
    })),
    // subscriptions(({ values, actions }) => ({
    //     /**
    //      * This subscription updates the insight for all visualizations
    //      * that haven't been refactored to use the data exploration yet.
    //      */
    //     response: (response: Record<string, any> | null) => {
    //         if (!values.isUsingDataExploration) {
    //             return
    //         }

    //         actions.setInsight(
    //             {
    //                 ...values.insight,
    //                 result: response?.result,
    //                 next: response?.next,
    // filters: values.insight.query ? {} : queryNodeToFilter(values.querySource),
    //             },
    //             {}
    //         )
    //     },
    // })),
])
