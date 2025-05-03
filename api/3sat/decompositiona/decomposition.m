% Function to split variables/clauses when 1-chip criterion is not
% satisfied

% INPUT :
% start_comb - No of starting nodes for decomposition. Maximum possible points [1,2,3,4]
% chip_size - Size of the number of variable on a chip. Currently 50
% S - The number of variables
% A - Dependency matrix of the variables

% OUTPUT :
% G_chip1 - Chip 1 nodes
% G_chip2 - Chip 2 nodes
% Clause_set1 - Clauses that are common to only chip 1 nodes
% Clause_set2 - Clauses that are common to only chip 2 nodes
% Clause_inter -  Clauses common to both chip 1 and chip 2 nodes
% s_node - Starting node for decomposition

% this uses the hop method and is limited to 100 variables

function [G_chip1,G_chip2,Clause_set1,Clause_set2,Clause_inter,s_node]=decomposition(start_comb,chip_size,S,A,Clauses)

r = start_comb;

combinations = nchoosek(1:S,r);

inter=[];
set1=[];
set2=[];

size_inter=[];
Cm={};
size_cl1=[];
C1={};
size_cl2=[];
C2={};
start_seq=[];
size_chip1=[];
chip1={};
size_chip2=[];
chip2={};


if r==1
    nd_1 = sum(A, 2);
    [sorted_degrees, sorted_indices] = sort(nd_1, 'descend');
    node = sorted_indices(1);
else
    node = combinations(1,:);
end

G1 = [node];
explored_nodes = [node];
count=2;
current_graph = G1;
G=[1:S];

one_hop = find(sum(A(G1, :), 1) > 0);
N = setdiff(one_hop, G1);
N1=N;

two_hop=find(sum(A(N, :), 1) > 0);
M = setdiff(two_hop, [G1, N]);

leaf_nodes = N(find(sum(A(N, M),2)==0));

while (length(G)-length(G1))>=chip_size

    while((length(G1) + length(N))<=chip_size) && ((length(G1) + length(N) +length(M))>chip_size)

        G1 = [G1, N];
        N1=N;
        one_hop = find(sum(A(G1, :), 1) > 0);
        N = setdiff(one_hop, G1);
        N= setdiff(N,leaf_nodes);
        two_hop=find(sum(A(N, :), 1) > 0);
        M = setdiff(two_hop, [G1,N]);
        if length(M)~=0
            leaf_nodes = N(find(sum(A(N, M),2)==0));
        else
            leaf_nodes=[];
        end
    end

    if (length(G1)<=chip_size && length([setdiff(G, G1),N1])<=chip_size)
        disp("division found");
        break;
    end

    if ((length(G1) + length(N))<=chip_size) && ((length(G1) + length(N) +length(M))<=chip_size)
        G1=[G1,N];
        one_hop = find(sum(A(G1, :), 1) > 0);
        N = setdiff(one_hop, G1);
        N= setdiff(N,leaf_nodes);
        two_hop=find(sum(A(N, :), 1) > 0);
        M = setdiff(two_hop, [G1,N]);
        leaf_nodes = N(find(sum(A(N, M),2)==0));
        continue;
    end
    if length(explored_nodes)==size(combinations,1)
        disp("Split not found")
        break;
    end

    G_chip1 = [G1,leaf_nodes];
    G_chip2 = [setdiff(G, G1)];


    for s1=1:size(Clauses,1)
        s2= abs(Clauses(s1,:));
        if all(ismember(s2,G_chip1)) && ~all(ismember(s2,G_chip2))
            set1 = [set1,s1];
        elseif ~all(ismember(s2,G_chip1)) && all(ismember(s2,G_chip2))
            set2 = [set2,s1];
        else
            inter = [inter,s1];
        end
    end


    if r ==1
        exp_start_nodes = explored_nodes(end);
    else
        exp_start_nodes = explored_nodes(end,:);
    end


    size_inter=[size_inter,length(inter)];
    Cm{end+1}=inter;
    size_cl1=[size_cl1,length(set1)];
    C1{end+1}=set1;
    size_cl2=[size_cl2,length(set2)];
    C2{end+1}=set2;
    size_chip1=[size_chip1,length(G_chip1)];
    chip1{end+1}=G_chip1;
    size_chip2=[size_chip2,length(G_chip2)];
    chip2{end+1}=G_chip2;


    if r ==1
        start_seq=[start_seq,exp_start_nodes];
    else
        start_seq=[start_seq;exp_start_nodes];
    end

    inter=[];
    set1=[];
    set2=[];

    if r==1
        start_node = sorted_indices(count);
        explored_nodes = [explored_nodes, start_node];
    else
        start_node = combinations(count,:);
        explored_nodes = [explored_nodes; start_node];
    end

    count=count+1;
    G1 = [start_node];

    one_hop = find(sum(A(G1, :), 1) > 0);
    N = setdiff(one_hop, G1);
    N1=N;

    two_hop=find(sum(A(N, :), 1) > 0);
    M = setdiff(two_hop, [G1, N]);

    leaf_nodes = N(find(sum(A(N, M),2)==0));
end

if (size(G,2)<=50)

    G_chip1 =G;
    G_chip2=[];

    if r ==1
        exp_start_nodes = explored_nodes(end);
        start_seq=[start_seq,exp_start_nodes];
    else
        exp_start_nodes = explored_nodes(end,:);
        start_seq=[start_seq;exp_start_nodes];
    end


    for s1=1:size(Clauses,1)
        s2= abs(Clauses(s1,:));
        if any(ismember(s2,G1))
            set1 = [set1,s1];
        else
            inter = [inter,s1];
        end
    end

    set1 = [set1, inter(1:(238 - size(set1,2)))];
    set2=[];
    inter = setdiff(inter,set1);



    % size_inter=[size_inter,length(inter)];
    Cm{end+1}=inter;
    % size_cl1=[size_cl1,length(set1)];
    C1{end+1}=set1;
    % size_cl2=[size_cl2,length(set2)];
    C2{end+1}=set2;
    % size_chip1=[size_chip1,length(G_chip1)];
    chip1{end+1}=G_chip1;
    % size_chip2=[size_chip2,length(G_chip2)];
    chip2{end+1}=G_chip2;

end


% This part is used to store all the possible split. This is not
% required for decomposition. The reason for renaming is to easily assign
% what to store size or the actual nodes.
if r==1
    allinter1=Cm;
    allset11=C1;
    allset21=C2;
    allstart1=start_seq;
    allnode11=chip1;
    allnode21=chip2;
elseif r==2
    allinter2=Cm;
    allset12=C1;
    allset22=C2;
    allstart2=start_seq;
    allnode12=chip1;
    allnode22=chip2;
elseif r==3
    allinter3=Cm;
    allset13=C1;
    allset23=C2;
    allstart3=start_seq;
    allnode13=chip1;
    allnode23=chip2;
elseif r==4
    allinter4=Cm;
    allset14=C1;
    allset24=C2;
    allstart4=start_seq;
    allnode14=chip1;
    allnode24=chip2;
end


% This part is used to find feasible split from all possible splits based
% on chip-size

if r==1
    p=find((size(allnode11,2) <=50) & (size(allnode21,2)<=50)& max(min(size(allset11),size(allset21))),1);
    if isempty(p)
        disp("Feasible split not found for 1 starting node");
    else
        s_node= allstart1(p);
        G_chip1 = cell2mat(allnode11(p));
        G_chip2 = cell2mat(allnode21(p));
        inter = cell2mat(allinter1(p));
        set1= cell2mat(allset11(p));
        set2 = cell2mat(allset21(p));
    end
elseif r==2
    p= find((size(allnode12) <=50) & (size(allnode22)<=50) & max(min(size(allset12),size(allset22))),1);
    if isempty(p)
        disp("Feasible split not found for 2 starting node");
    else
        s_node= allstart2(p,:);
        G_chip1 = cell2mat(allnode12(p));
        G_chip2 = cell2mat(allnode22(p));
        inter = cell2mat(allinter2(p));
        set1 = cell2mat(allset12(p));
        set2 = cell2mat(allset22(p));
    end
elseif r==3
    p= find((size(allnode13) <=50) & (size(allnode23)<=50)& max(min(size(allset13),size(allset23))),1);
    if isempty(p)
        disp("Feasible split not found for 3 starting node");
    else
        s_node= allstart3(p,:);
        G_chip1 = cell2mat(allnode13(p));
        G_chip2 = cell2mat(allnode23(p));
        inter= cell2mat(allinter3(p));
        set1 = cell2mat(allset13(p));
        set2 = cell2mat(allset23(p));
    end
elseif r==4
    p=find((size(allnode14) <=50) & (size(allnode24)<=50)& max(min(size(allset14),size(allset24))),1);
    if isempty(p)
        disp("Feasible split not found for 4 starting node");
    else
        s_node= allstart4(p,:);
        G_chip1 = cell2mat(allnode14(p));
        G_chip2 = cell2mat(allnode24(p));
        inter = cell2mat(allinter4(p));
        set1 = cell2mat(allset14(p));
        set2 = cell2mat(allset24(p));
    end
end

Clause_set1 = Clauses(set1, :);
Clause_set2 = Clauses(set2, :);
Clause_inter = Clauses(inter,:);

end
