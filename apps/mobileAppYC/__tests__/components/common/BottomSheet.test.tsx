import React from 'react';
import TestRenderer from 'react-test-renderer';
import CustomBottomSheet from '@/shared/components/common/BottomSheet/BottomSheet';

describe('CustomBottomSheet', () => {
  it('renders default view content', () => {
    let tree: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <CustomBottomSheet>
          <></>
        </CustomBottomSheet>
      );
    });
    expect(tree!).toBeTruthy();
  });

  it('renders scrollView content when contentType is scrollView', () => {
    let tree: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <CustomBottomSheet contentType="scrollView">
          <></>
        </CustomBottomSheet>
      );
    });
    expect(tree!).toBeTruthy();
  });

  it('renders flatList when data and renderItem provided', () => {
    const data = [1, 2, 3];
    const renderItem = ({item}: {item: number}) => <>{item}</> as any;
    let tree: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <CustomBottomSheet
          contentType="flatList"
          flatListData={data}
          flatListRenderItem={renderItem}
        >
          <></>
        </CustomBottomSheet>
      );
    });
    expect(tree!).toBeTruthy();
  });

  it('warns when flatList is missing data or renderItem', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    TestRenderer.act(() => {
      TestRenderer.create(
        <CustomBottomSheet contentType="flatList">
          <></>
        </CustomBottomSheet>
      );
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('enables backdrop when flag set', () => {
    let tree: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <CustomBottomSheet enableBackdrop>
          <></>
        </CustomBottomSheet>
      );
    });
    expect(tree!).toBeTruthy();
  });

  it('renders custom handle component when provided', () => {
    const Handle = () => null as any;
    let tree: TestRenderer.ReactTestRenderer;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <CustomBottomSheet customHandle handleComponent={Handle}>
          <></>
        </CustomBottomSheet>
      );
    });
    expect(tree!).toBeTruthy();
  });
});
